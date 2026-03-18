(function() {
  'use strict';

  // 확장 프로그램 컨텍스트 유효성 확인
  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  // 중복 주입 방지
  if (window.MLBParkerLoaded) return;
  window.MLBParkerLoaded = true;

  if (!isContextValid()) {
    console.log('MLBParker: 컨텍스트가 무효화되었습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 페이지에서 작성자 데이터를 추출하는 유틸리티
  function extractAuthorData() {
    try {
      // 0. 확인: 특정 게시글 보기 페이지인 경우에만 실행
      // 요청대로 'id' 파라미터를 엄격하게 확인
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('id')) {
          return null;
      }
      const postId = urlParams.get('id');
      
      // m=view가 있거나 id가 있으면 보기 페이지임
      
      // 1. UID를 포함하는 요소 찾기 (ID 식별의 기준)
      // 일반적인 패턴: .photo > a[data-uid], .nick > a[data-uid]
      const uidElement = document.querySelector('span.photo > a[data-uid], .nick > a[data-uid], .nick > a[onclick*="user="]');
      
      if (!uidElement) return null;

      // 2. UID 및 사이트 추출
      let uid = uidElement.getAttribute('data-uid');
      let site = 'donga.com'; // 기본값
      
      const onclick = uidElement.getAttribute('onclick') || '';
      if (onclick) {
          const uMatch = onclick.match(/user=([^&']+)/);
          if (uMatch) uid = uMatch[1];
          
          const sMatch = onclick.match(/site=([^&']+)/);
          if (sMatch) site = sMatch[1];
      }

      if (!uid) return null;

      // 3. 닉네임 추출
      // 전략: 컨테이너를 찾고 .nick 클래스 확인
      let nickname = '';
      
      // 예상 컨테이너 찾기 (게시글 보기: li.items, 목록: td, 댓글: .nick_box)
      const container = uidElement.closest('li.items, td, .nick_box, .reply_box');
      
      if (container) {
          const nickSpan = container.querySelector('.nick');
          if (nickSpan) {
              nickname = nickSpan.textContent.trim();
          }
      }

      // 대체: .nick을 찾지 못하면 uidElement 자체의 텍스트 사용
      if (!nickname) {
          nickname = uidElement.textContent.trim();
      }

      // 4. 프로필 이미지 추출
      let profileImage = 'https://mlbpark.donga.com/mp/images/mlbpark/profile_default.png';
      if (container) {
          const img = container.querySelector('img');
          if (img && img.src) profileImage = img.src;
      }

      return { uid, site, nickname: nickname || 'User', profileImage, postId };

    } catch (e) {
      console.error('MLBParker: 작성자 데이터 추출 중 오류 발생', e);
    }
    return null;
  }

  // 작성자 데이터를 백그라운드 스크립트로 전송
  function notifyBackground(authorData) {
    if (!isContextValid()) return;
    try {
      if (authorData) {
        chrome.runtime.sendMessage({ 
          action: 'AUTHOR_UID_DETECTED', 
          uid: authorData.uid,
          nickname: authorData.nickname,
          profileImage: authorData.profileImage,
          postId: authorData.postId,
          site: authorData.site
        });
      } else {
        // 명확한 신호 전송
        chrome.runtime.sendMessage({ action: 'NO_AUTHOR_DETECTED' });
      }
    } catch (e) {
      // 무시
    }
  }

  // 백그라운드로부터의 강제 확인 요청 리스너 (예: 요약/탭 업데이트 시)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CHECK_PAGE_STATUS') {
        const data = extractAuthorData();
        notifyBackground(data);
    }
  });

  // 초기화
  const authorData = extractAuthorData();
  notifyBackground(authorData); // 결과 전송 (데이터 또는 null)

  const observer = new MutationObserver(() => {
    if (!isContextValid()) {
      observer.disconnect();
      return;
    }
    const newAuthorData = extractAuthorData();
    notifyBackground(newAuthorData);
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
