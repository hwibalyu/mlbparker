const MLBPRAK_BASE = 'https://mlbpark.donga.com/mp/b.php';

document.addEventListener('DOMContentLoaded', () => {
  const postListContainer = document.getElementById('post-list');
  const paginationContainer = document.getElementById('pagination');
  const profileImg = document.getElementById('profile-img');
  const profileNickname = document.getElementById('profile-nickname');
  const profileDate = document.getElementById('profile-date');
  const header = document.getElementById('header');
  
  let currentUid = null;
  let currentSite = 'donga.com';
  let currentBoardFilter = 'all';
  let currentPostId = null;
  let currentTabId = null;
  let currentTagFilter = null;
  
  // 탭 컨텍스트 캐시: tabId -> { uid, nickname, profileImage, profileDate, postId, boardFilter, html, paginationHtml, tagStatsHtml }
  const tabContexts = new Map();
  
  const MAX_CACHE_SIZE = 10;

  function saveTabContext(tabId) {
    if (!tabId || !currentUid) return;
    const loadMoreBtn = document.getElementById('load-more-btn');
    tabContexts.set(tabId, {
        uid: currentUid,
        site: currentSite,
        nickname: profileNickname.textContent,
        profileImage: profileImg.src,
        profileDate: profileDate.textContent,
        postId: currentPostId,
        boardFilter: currentBoardFilter,
        tagFilter: currentTagFilter,
        html: postListContainer.innerHTML,
        paginationHtml: paginationContainer.innerHTML,
        tagStatsHtml: document.getElementById('tag-stats').innerHTML,
        nextPageUrl: loadMoreBtn ? loadMoreBtn.getAttribute('data-next-url') : null
    });
  }

  function restoreTabContext(tabId) {
    const context = tabContexts.get(tabId);
    if (!context) return false;

    currentUid = context.uid;
    currentSite = context.site || 'donga.com';
    currentPostId = context.postId;
    currentBoardFilter = context.boardFilter;
    currentTagFilter = context.tagFilter || null;

    profileImg.src = context.profileImage;
    profileNickname.textContent = context.nickname;
    profileDate.textContent = context.profileDate;
    
    // 필터 UI 업데이트
    const boardFilter = document.getElementById('board-filter');
    if (boardFilter) {
        boardFilter.value = currentBoardFilter;
        boardFilter.disabled = !!currentTagFilter; // 태그 필터가 있으면 비활성화
    }

    postListContainer.innerHTML = context.html;
    paginationContainer.innerHTML = context.paginationHtml;
    
    // 사용자 컨텍스트를 복원한 경우 헤더 표시
    if (header) header.classList.remove('hidden');

    const tagStatsContainer = document.getElementById('tag-stats');
    if (tagStatsContainer && context.tagStatsHtml) {
        tagStatsContainer.innerHTML = context.tagStatsHtml;
        
        // Re-attach listeners to restored pills
        const pills = tagStatsContainer.querySelectorAll('.tag-pill');
        pills.forEach(pill => {
            const text = pill.textContent.split(' (')[0];
            const tag = text === '전체' ? null : text;
            const board = pill.dataset.board || null;
            pill.onclick = () => onTagClick(tag, board);
        });
    }

    // '더보기' 버튼 기능 복원
    if (context.nextPageUrl) {
         const btn = document.getElementById('load-more-btn');
         if (btn) {
             btn.onclick = () => {
                btn.textContent = 'Loading...';
                btn.disabled = true;
                fetchAndRender(context.nextPageUrl, true);
             };
         }
    }

    updateTableHighlight();
    return true;
  }

  // --- 메인 로직 ---

  function initUserView(uid, userImage, nickname, site = 'donga.com') {
    const blockBtn = document.getElementById('block-btn');
    const boardFilter = document.getElementById('board-filter');
    
    // 차단 버튼 설정
    if (blockBtn) {
        blockBtn.onclick = () => blockUser(currentUid, profileNickname.textContent);
    }
    
    // 필터 리스너 설정
    if (boardFilter) {
        // 사용자 전환 시 필터 초기화
        if (currentUid !== uid) {
            boardFilter.value = 'all';
            boardFilter.disabled = false; // 초기화 시 활성화
            currentBoardFilter = 'all';
            currentTagFilter = null;
        }
        
        boardFilter.onchange = (e) => {
            currentBoardFilter = e.target.value;
            // 새로운 필터로 목록 새로고침
            postListContainer.innerHTML = '<div class="loading">Loading posts...</div>';
            paginationContainer.innerHTML = '';
            
            let url = buildFetchUrl(currentBoardFilter, currentUid, null);
            fetchAndRender(url, false);
        };
    }
    
    if (!uid) {
        // 사용자가 감지되지 않음 (예: 게시글 페이지가 아님)
        currentUid = null;
        currentSite = 'donga.com';
        currentTagFilter = null;
        postListContainer.innerHTML = '<div class="loading">글 내용을 보고 있지 않습니다.<br>(게시글을 클릭해주세요)</div>';
        paginationContainer.innerHTML = '';
        
        // 헤더 숨기기
        if (header) header.classList.add('hidden');
        return;
    }

    // 헤더 표시
    if (header) header.classList.remove('hidden');

    if (currentUid === uid) return; // 동일한 사용자일 경우 중복 로드 방지
    
    currentUid = uid;
    currentSite = site;

    if (userImage) profileImg.src = userImage;
    if (nickname) {
        profileNickname.textContent = nickname;
    }
    
    // UID가 있으면 항상 날짜와 태그 통계 가져오기
    fetchJoinDate(uid, site);
    fetchTagStats(uid, site);

    // 뷰 초기화
    postListContainer.innerHTML = '<div class="loading">Loading posts...</div>';
    paginationContainer.innerHTML = ''; // 더보기 버튼 초기화

    // 초기 페칭
    let initialUrl = buildFetchUrl(currentBoardFilter, uid, currentTagFilter);
    fetchAndRender(initialUrl, false); 
  }
  
  async function blockUser(uid, nickname) {
      if (!uid) return;
      
      const confirmed = confirm(`정말로 [${nickname || uid}] 사용자를 차단하시겠습니까?`);
      if (!confirmed) return;
      
      try {
          const formData = new FormData();
          formData.append('m', 'lockerAdd');
          formData.append('key', 'id');
          formData.append('value', uid); // 차단할 UID
          
          const response = await fetch('https://mlbpark.donga.com/mp/op.php', {
              method: 'POST',
              body: formData
          });
          
          if (!response.ok) throw new Error('Network error');
          
          alert('차단되었습니다.');
          
      } catch (err) {
          console.error('Block failed:', err);
          alert('차단에 실패했습니다.');
      }
  }

  async function fetchJoinDate(uid, detectedSite = 'donga.com') {
    try {
        profileDate.textContent = 'Loading date...';
        
        // 시도할 사이트 순서
        const sitesToTry = [detectedSite];
        const fallbacks = ['donga.com', 'naver.com', 'kakao.com'];
        fallbacks.forEach(s => {
            if (!sitesToTry.includes(s)) sitesToTry.push(s);
        });

        let finalDate = 'error';

        for (const site of sitesToTry) {
            try {
                const formData = new FormData();
                formData.append('m', 'regist');
                formData.append('user', uid);
                formData.append('site', site);

                const response = await fetch('https://mlbpark.donga.com/mp/action.php', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) continue;

                const text = await response.text();
                const cleanDate = text.trim();
                
                // 유효한 응답인 경우 (성공!)
                if (cleanDate && cleanDate !== 'error' && !cleanDate.includes('not found')) {
                    finalDate = cleanDate;
                    break;
                }
            } catch (innerErr) {
                console.warn(`Fetch join date for ${site} failed, trying next...`);
            }
        }
        
        profileDate.textContent = `가입일: ${finalDate}`;

    } catch (err) {
        console.error('Error fetching join date:', err);
        profileDate.textContent = '가입일: error';
    }
  }

  async function fetchTagStats(uid, site = 'donga.com') {
    const tagStatsContainer = document.getElementById('tag-stats');
    if (!tagStatsContainer || !uid) return;
    
    // 먼저 영구 캐시 확인
    try {
        const key = `tags_${uid}`;
        const data = await chrome.storage.local.get([key, 'tag_cache_keys']);
        if (data[key]) {
            tagStatsContainer.innerHTML = data[key];
            
            // 캐시된 버튼에 클릭 리스너 다시 연결
            const pills = tagStatsContainer.querySelectorAll('.tag-pill');
            pills.forEach(pill => {
                const text = pill.textContent.split(' (')[0];
                const tag = text === '전체' ? null : text;
                
                // 현재 필터에 따라 활성 상태 업데이트
                if (tag === currentTagFilter) {
                    pill.classList.add('active');
                } else {
                    pill.classList.remove('active');
                }

                const board = pill.dataset.board || null;
                pill.onclick = () => onTagClick(tag, board);
            });
            
            // LRU 위치 업데이트
            let keys = data.tag_cache_keys || [];
            keys = keys.filter(k => k !== key);
            keys.push(key);
            await chrome.storage.local.set({ tag_cache_keys: keys });
            return;
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }
    
    tagStatsContainer.innerHTML = '<span class="loading" style="height:auto; font-size:10px;">Loading stats...</span>';
    
    try {
        const MAX_PAGES_STATS = 5;
        const tagCounts = {};
        const tagBoards = {}; // 태그별 게시판 매핑
        let oldestDate = null;
        let currentUrl = `${MLBPRAK_BASE}?m=user&user=${uid}&site=donga.com`;
        
        for (let i = 0; i < MAX_PAGES_STATS; i++) {
            const response = await fetch(currentUrl);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            const posts = parsePosts(doc);
            posts.forEach(post => {
                if (post.category) {
                    tagCounts[post.category] = (tagCounts[post.category] || 0) + 1;
                    // 태그의 게시판 정보 저장 (없는 경우에만 설정하거나, 빈도수 로직은 복잡하니 발견된 첫 게시판 사용)
                     if (!tagBoards[post.category] && post.boardName) {
                        tagBoards[post.category] = getBoardParamFromText(post.boardName);
                    }
                }
                
                // 가장 오래된 날짜 추적
                if (post.date) {
                    if (!oldestDate) {
                        oldestDate = post.date;
                    } else {
                        // "YY-MM-DD" vs "HH:mm" (오늘)
                        const isNewDateYY = post.date.includes('-');
                        const isOldDateYY = oldestDate.includes('-');
                        
                        if (isNewDateYY && !isOldDateYY) {
                            oldestDate = post.date;
                        } else if (isNewDateYY && isOldDateYY) {
                            if (post.date < oldestDate) oldestDate = post.date;
                        }
                    }
                }
            });

            // 다음 페이지 링크 찾기
            const pagingBox = doc.querySelector('.paging_box');
            let nextLink = null;
            if (pagingBox) {
                const currentStrong = pagingBox.querySelector('strong');
                let currentPage = 1;
                if (currentStrong) {
                    currentPage = parseInt(currentStrong.textContent.replace(/[\[\]]/g, ''), 10);
                }
                const links = pagingBox.querySelectorAll('a');
                for (const link of links) {
                    const pageNum = parseInt(link.textContent.trim().replace(/[\[\]]/g, ''), 10);
                    if (!isNaN(pageNum) && pageNum === currentPage + 1) {
                        const href = link.getAttribute('href');
                        if (href) nextLink = new URL(href, MLBPRAK_BASE).href;
                        break;
                    }
                }
                if (!nextLink) {
                    const nextImgLink = Array.from(links).find(link => {
                        const img = link.querySelector('img');
                        return (img && img.src.includes('next')) || link.title === '다음';
                    });
                    if (nextImgLink) {
                        const href = nextImgLink.getAttribute('href');
                        if (href) nextLink = new URL(href, MLBPRAK_BASE).href;
                    }
                }
            }

            if (!nextLink) break;
            currentUrl = nextLink;
            await delay(150); // 요청 간 150ms 지연
        }

        // 개수별로 태그 정렬
        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1]);

        if (sortedTags.length === 0) {
            tagStatsContainer.innerHTML = '';
            return;
        }

        tagStatsContainer.innerHTML = '';
        
        // "전체" 태그 추가
        const allPill = document.createElement('span');
        allPill.className = 'tag-pill' + (currentTagFilter === null ? ' active' : '');
        allPill.textContent = '전체';
        allPill.onclick = () => onTagClick(null, null);
        tagStatsContainer.appendChild(allPill);

        sortedTags.forEach(([tag, count]) => {
            const pill = document.createElement('span');
            pill.className = 'tag-pill' + (currentTagFilter === tag ? ' active' : '');
            pill.textContent = `${tag} (${count})`;
            
            const boardParam = tagBoards[tag];
            if (boardParam) {
                pill.dataset.board = boardParam;
            }
            
            pill.onclick = () => onTagClick(tag, boardParam);
            tagStatsContainer.appendChild(pill);
        });
        
        // 기간 레이블 추가
        if (oldestDate) {
            const periodLabel = document.createElement('span');
            periodLabel.style.fontSize = '10px';
            periodLabel.style.color = '#999';
            periodLabel.style.marginLeft = '4px';
            periodLabel.style.alignSelf = 'center';
            periodLabel.textContent = `(${oldestDate} ~ 현재 기준)`;
            tagStatsContainer.appendChild(periodLabel);
        }

        // 영구 캐시로 저장
        const key = `tags_${uid}`;
        const cacheData = await chrome.storage.local.get('tag_cache_keys');
        let keys = cacheData.tag_cache_keys || [];
        
        keys = keys.filter(k => k !== key);
        keys.push(key);
        
        const updateObj = { [key]: tagStatsContainer.innerHTML };
        
        if (keys.length > MAX_CACHE_SIZE) {
            const oldestKey = keys.shift();
            await chrome.storage.local.remove(oldestKey);
        }
        
        updateObj.tag_cache_keys = keys;
        await chrome.storage.local.set(updateObj);

    } catch (err) {
        console.error('Error fetching tag stats:', err);
        tagStatsContainer.innerHTML = '';
    }
  }

  function getBoardParamFromText(boardName) {
    const name = boardName.toUpperCase().trim();
    if (name.includes('MLB') || name.includes('메이저리그')) return 'mlbtown';
    if (name.includes('한국야구') || name.includes('KBO')) return 'kbotown';
    if (name.includes('BULLPEN') || name.includes('불펜')) return 'bullpen';
    return null;
  }

  function buildFetchUrl(board, uid, tag) {
      // 1. 태그 필터링 (말머리 검색)
      if (tag) {
          const encodedTag = encodeURIComponent(tag);
          // 태그가 있으면 태그의 보드(또는 현재 필터)를 사용하여 검색
          const targetBoard = board || 'all'; 
          return `${MLBPRAK_BASE}?select=spf&subselect=sid&m=search&b=${targetBoard}&search_select2=spf&query=${encodedTag}&search_select3=sid&subquery=${uid}&x=0&y=0`;
      }
      
      // 2. 게시판 필터링 (사용자 게시글 검색)
      if (board && board !== 'all') {
          // 특정 게시판만 보고 싶을 때 (서버 사이드 필터링)
          return `${MLBPRAK_BASE}?select=sid&subselect=sct&m=search&b=${board}&search_select2=sid&query=${uid}&search_select3=sct&subquery=&x=0&y=0`;
      }

      // 3. 전체보기 (기본 사용자 검색)
      // board == 'all' 이면 기존 m=user 방식 사용 (전체 게시판)
      return `${MLBPRAK_BASE}?m=user&user=${uid}&site=donga.com`;
  }

  function setBoardFilterDisabled(disabled) {
      const boardFilter = document.getElementById('board-filter');
      if (boardFilter) {
          boardFilter.disabled = disabled;
      }
  }

  function onTagClick(tag, boardParam) {
    if (currentTagFilter === tag) return;
    currentTagFilter = tag;
    
    // 태그가 선택되면 게시판 필터 비활성화, 해제되면 활성화
    setBoardFilterDisabled(!!tag);
    
    // 필터 UI 활성 상태 업데이트
    const tagStatsContainer = document.getElementById('tag-stats');
    if (tagStatsContainer) {
        const pills = tagStatsContainer.querySelectorAll('.tag-pill');
        pills.forEach(pill => {
            const pillText = pill.textContent.split(' (')[0];
            const pillTag = pillText === '전체' ? null : pillText;
            if (pillTag === currentTagFilter) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    // 목록 새로고침
    postListContainer.innerHTML = '<div class="loading">Loading filtered posts...</div>';
    paginationContainer.innerHTML = '';
    
    // boardParam이 있으면 우선 사용하고, 없으면 현재 선택된 게시판 필터 사용
    const targetBoard = boardParam || currentBoardFilter;
    const url = buildFetchUrl(targetBoard, currentUid, currentTagFilter);
    
    fetchAndRender(url, false);
  }

  // 지연 함수
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchAndRender(url, isAppend = false) {
    try {
      if (!isAppend) {
          postListContainer.innerHTML = '<div class="loading">Loading posts...</div>';
      } else {
          const btn = document.getElementById('load-more-btn');
          if (btn) {
              btn.textContent = 'Loading...';
              btn.disabled = true;
          }
      }

      const TARGET_COUNT = 30; // 표시할 대상 게시글 수
      const MAX_PAGES = currentTagFilter ? 5 : 2; // 필터링된 뷰에서는 더 많은 페이지 확인
      
      let accumulatedPosts = [];
      let currentUrl = url;
      let lastDoc = null;
      let pagesFetched = 0;

      // 재귀 / 루프 페칭
      while (accumulatedPosts.length < TARGET_COUNT && pagesFetched < MAX_PAGES) {
          if (pagesFetched > 0) {
              await delay(150); // 서버 보호를 위해 페이지 간 150ms 지연
          }

          const response = await fetch(currentUrl);
          const text = await response.text();
          const parser = new DOMParser();
          lastDoc = parser.parseFromString(text, 'text/html');

          const posts = parsePosts(lastDoc);
          
          // 클라이언트 사이드 필터링 제거 (서버 사이드 필터링 적용)
          // const filtered = posts.filter(...) 로직 삭제
          const filtered = posts; // 모든 포스트 사용

          accumulatedPosts = accumulatedPosts.concat(filtered);

          // 루프를 위한 다음 URL 준비
          if (accumulatedPosts.length < TARGET_COUNT) {
             const pagingBox = lastDoc.querySelector('.paging_box');
             let nextLink = null;
             
             if (pagingBox) {
                  const currentStrong = pagingBox.querySelector('strong');
                  let currentPage = 1;
                  if (currentStrong) {
                      const text = currentStrong.textContent.replace(/[\[\]]/g, '');
                      currentPage = parseInt(text, 10);
                  }
                  
                  const links = pagingBox.querySelectorAll('a');
                  for (const link of links) {
                      const textLines = link.textContent.trim().replace(/[\[\]]/g, '');
                      const pageNum = parseInt(textLines, 10);
                      if (!isNaN(pageNum) && pageNum === currentPage + 1) {
                          const href = link.getAttribute('href');
                          if (href) nextLink = new URL(href, MLBPRAK_BASE).href;
                          break; 
                      }
                  }
                  
                  if (!nextLink) {
                       // 다음 블록 확인
                       const nextImgLink = Array.from(links).find(link => {
                           const img = link.querySelector('img');
                           return (img && img.src.includes('next')) || link.title === '다음';
                       });
                       if (nextImgLink) {
                           const href = nextImgLink.getAttribute('href');
                           if (href) nextLink = new URL(href, MLBPRAK_BASE).href;
                       }
                  }
             }
             
             if (nextLink) {
                  currentUrl = nextLink;
                  pagesFetched++;
             } else {
                  // 더 이상 페이지가 없음
                  break; 
             }
          } else {
              // 목표 수치 도달
              break;
          }
      }

      renderPosts(accumulatedPosts, isAppend);
      
      // 마지막으로 가져온 문서를 사용하여 더보기 버튼 업데이트
      if (lastDoc) {
          updateLoadMoreButton(lastDoc);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (!isAppend) {
        postListContainer.innerHTML = '<div class="loading">Error loading posts.</div>';
      } else {
         const btn = document.getElementById('load-more-btn');
         if (btn) {
            btn.textContent = 'Error loading more';
            btn.disabled = false;
         }
      }
    }
  }

  function parsePosts(doc) {
    const rows = doc.querySelectorAll('.tbl_type01 tbody tr');
    const posts = [];

    rows.forEach(row => {
      if (!row || row.cells.length < 4) return;

      // 컬럼 1: 게시판
      const boardCell = row.cells[0];
      const boardName = boardCell.textContent.trim();

      // 컬럼 2: 제목 및 카테고리
      const titleCell = row.cells[1];
      
      const links = Array.from(titleCell.querySelectorAll('a'));
      const postLink = links.find(l => {
          const h = l.getAttribute('href');
          return h && (h.includes('id=') || h.includes('m=view'));
      }) || links[0];

      if (!postLink) return;

      const href = postLink.getAttribute('href');
      const absoluteLink = new URL(href, MLBPRAK_BASE).href;
      
      const replySpan = titleCell.querySelector('.replycnt, .replycnt_new');
      const replyCount = replySpan ? replySpan.textContent.replace(/[\[\]]/g, '') : '';

      // 게시글 제목 계산
      const cellClone = titleCell.cloneNode(true);
      const replyInClone = cellClone.querySelector('.replycnt, .replycnt_new');
      if (replyInClone) replyInClone.remove();
      cellClone.querySelectorAll('img').forEach(img => img.remove());

      // 카테고리 추출 시도
      let category = '';
      const listWord = cellClone.querySelector('.list_word');
      
      if (listWord) {
          category = listWord.textContent.trim();
          listWord.remove(); // 제목에 포함되지 않도록 클론에서 삭제
      }

      let titleText = cellClone.textContent.trim();
      titleText = titleText.replace(/\s+/g, ' ');

      // 대체: [카테고리] 형식 확인
      if (!category && titleText.startsWith('[')) {
          const closeIdx = titleText.indexOf(']');
          if (closeIdx > 0) {
              category = titleText.substring(1, closeIdx);
              titleText = titleText.substring(closeIdx + 1).trim();
          }
      }

      if (!titleText) {
          titleText = postLink.textContent.trim();
      }

      // 컬럼 4: 날짜
      const dateCell = row.cells[3];
      let date = dateCell.textContent.trim();
      
      // YYYY-MM-DD 를 YY-MM-DD 로 변환
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          date = date.substring(2);
      }

      // 하이라이팅을 위해 absoluteLink에서 postId 추출
      let postId = null;
      try {
          const postUrl = new URL(absoluteLink);
          postId = postUrl.searchParams.get('id');
      } catch(e) {}

      posts.push({
        boardName,
        category,
        title: titleText,
        link: absoluteLink,
        replyCount,
        date,
        postId
      });
    });

    return posts;
  }

  function updateLoadMoreButton(doc) {
    paginationContainer.innerHTML = ''; // 버튼 초기화

    const pagingBox = doc.querySelector('.paging_box');
    let nextLink = null;

    if (pagingBox) {
        // 1. 현재 페이지 확인
        const currentStrong = pagingBox.querySelector('strong');
        let currentPage = 1;
        if (currentStrong) {
            const text = currentStrong.textContent.replace(/[\[\]]/g, '');
            currentPage = parseInt(text, 10);
        }

        // 2. (현재 페이지 + 1) 링크 찾기
        const links = pagingBox.querySelectorAll('a');
        
        for (const link of links) {
            const text = link.textContent.trim().replace(/[\[\]]/g, '');
            const pageNum = parseInt(text, 10);
            
            if (!isNaN(pageNum) && pageNum === currentPage + 1) {
                const href = link.getAttribute('href');
                if (href) nextLink = new URL(href, MLBPRAK_BASE).href;
                break; 
            }
        }

        // 3. 찾지 못한 경우 "다음" 화살표 확인
        if (!nextLink) {
             const nextImgLink = Array.from(links).find(link => {
                 const img = link.querySelector('img');
                 return (img && img.src.includes('next')) || link.title === '다음';
             });
             if (nextImgLink) {
                 const href = nextImgLink.getAttribute('href');
                 if (href) nextLink = new URL(href, MLBPRAK_BASE).href;
             }
        }
    }

    if (nextLink) {
        const btn = document.createElement('button');
        btn.id = 'load-more-btn';
        btn.textContent = '더보기 (Load More)';
        btn.setAttribute('data-next-url', nextLink); // 캐싱을 위해 저장
        btn.onclick = () => {
            btn.textContent = 'Loading...';
            btn.disabled = true;
            fetchAndRender(nextLink, true);
        };
        paginationContainer.appendChild(btn);
    } else {
        // 마지막 페이지 메시지 표시
        const endMsg = document.createElement('div');
        endMsg.className = 'end-message';
        endMsg.textContent = '마지막 페이지입니다.';
        paginationContainer.appendChild(endMsg);
    }
  }

  function renderPosts(posts, isAppend) {
    if (!isAppend) {
        // 신규 렌더링
        if (posts.length === 0) {
            postListContainer.innerHTML = '<div class="loading">No posts found.</div>';
            return;
        }

        postListContainer.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'post-table';
        table.id = 'main-post-table';
        
        posts.forEach(post => {
            table.appendChild(createPostRow(post));
        });
        
        postListContainer.appendChild(table);

    } else {
        // 추가 모드
        const table = document.getElementById('main-post-table');
        if (!table) return;

        posts.forEach(post => {
            table.appendChild(createPostRow(post));
        });
    }
  }

  function createPostRow(post) {
      const tr = document.createElement('tr');
      
      if (post.postId && post.postId === currentPostId) {
          tr.classList.add('highlight');
      }
      if (post.postId) {
          tr.setAttribute('data-post-id', post.postId);
      }

      // 게시판
      const tdBoard = document.createElement('td');
      tdBoard.className = 'col-board';
      tdBoard.textContent = post.boardName;
      tr.appendChild(tdBoard);

      // 제목
      const tdTitle = document.createElement('td');
      tdTitle.className = 'col-title';
      
      const a = document.createElement('a');
      a.href = post.link;
      
      // 카테고리 요소
      if (post.category) {
          const catSpan = document.createElement('span');
          catSpan.className = 'category';
          catSpan.textContent = post.category;
          
          // 전체 행을 클릭 가능하게 하면서 카테고리만 스타일을 다르게 하기 위해 
          // A 태그 내부에 카테고리와 제목을 함께 넣습니다.
          
          a.textContent = ''; // 초기화
          a.appendChild(catSpan);
          a.appendChild(document.createTextNode(' ' + post.title));
      } else {
          a.textContent = post.title;
      }
      
      // 새 탭에서 열기
      a.target = '_blank';
      
      // 표준 브라우저 동작인 target="_blank"에 의존하기 위해 수동 클릭 리스너 제거
      // 이 방식이 다양한 컨텍스트에서 더 안정적입니다.

      tdTitle.appendChild(a);

      if (post.replyCount) {
        const span = document.createElement('span');
        span.className = 'reply-cnt';
        span.textContent = `[${post.replyCount}]`;
        tdTitle.appendChild(span);
      }
      tr.appendChild(tdTitle);

      // 날짜
      const tdDate = document.createElement('td');
      tdDate.className = 'col-date';
      tdDate.textContent = post.date;
      tr.appendChild(tdDate);
      
      return tr;
  }


  // --- 윈도우 컨텍스트 처리 ---
  let myWindowId = null;
  chrome.windows.getCurrent((win) => {
    myWindowId = win.id;
    
    // 초기 로드: 현재 윈도우의 활성 탭에 대해 캐시된 작성자 정보를 백그라운드에 요청
    chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB_AUTHOR', windowId: myWindowId }, (cached) => {
        if (cached) {
            const { uid, nickname, profileImage, postId, tabId, site } = cached;
            currentTabId = tabId;
            currentPostId = postId;
            initUserView(uid, profileImage, nickname, site);
        } else {
            // "작성자 없음" 신호
            initUserView(null);
        }
    });
  });

  // 업데이트 리스너
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'UPDATE_SIDE_PANEL') {
      // 윈도우 간 간섭을 피하기 위해 windowId로 필터링
      if (message.windowId && myWindowId && message.windowId !== myWindowId) {
          return;
      }

      const { uid, nickname, profileImage, postId, tabId, site } = message;
      
      const targetSite = site || 'donga.com';
      const isTabSwitchRaw = (currentTabId !== tabId); // Define here for logging
      console.log(`[Msg] Tab: ${tabId}, Current: ${currentTabId}, isSwitch: ${isTabSwitchRaw}, uid: ${uid}, curUid: ${currentUid}`);

      // 1. 탭 전환 전 이전 탭의 상태 저장
      if (currentTabId && currentTabId !== tabId) {
          console.log(`[Save] Switching from ${currentTabId} to ${tabId}. Saving...`);
          saveTabContext(currentTabId);
      }

      // 2. 탭 전환 로직
      currentTabId = tabId;
      currentPostId = postId;

      if (isTabSwitchRaw) {
          console.log(`[Restore] Attempting restore for ${tabId}`);
          const restored = restoreTabContext(tabId);
          console.log(`[Restore] Result for ${tabId}: ${restored}`);
          if (restored) {
              // 동일 사용자라도 태그 스태츠가 비어 있으면 다시 페칭 트리거
              const tagStatsContainer = document.getElementById('tag-stats');
              const hasTags = tagStatsContainer && tagStatsContainer.querySelector('.tag-pill');
              
              if (uid === currentUid) {
                  if (!hasTags) {
                      fetchTagStats(uid, targetSite);
                  }
                  updateTableHighlight();
                  return; 
              }
          }
      }

      // 3. 사용자 변경 또는 신규 로드 로직
      if (uid !== currentUid || targetSite !== currentSite) {
          console.log(`[Init] New user/site detected. uid: ${uid}, site: ${targetSite}`);
          // initUserView가 실행되도록 currentUid 강제 초기화
          currentUid = null; 
          initUserView(uid, profileImage, nickname, targetSite);
      } else {
          // 동일 사용자일 경우 postId에 대한 하이라이트 업데이트
          updateTableHighlight();
      }
    }
  });

  function updateTableHighlight() {
      const rows = document.querySelectorAll('.post-table tr');
      rows.forEach(row => {
          const rowPostId = row.getAttribute('data-post-id');
          if (rowPostId) {
              if (rowPostId === currentPostId) {
                  row.classList.add('highlight');
              } else {
                  row.classList.remove('highlight');
              }
          }
      });
  }

});
