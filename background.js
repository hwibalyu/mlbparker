// 아이콘 클릭 시 사이드 패널이 열리도록 설정
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

function updateSidePanelState(tabId, url) {
  // 모든 페이지에서 사이드 패널 활성화
  chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true
  }).catch(() => {});
}

// --- 탭 기반 캐시 ---
const tabAuthors = {}; // { 탭ID: { uid, nickname, profileImage, postId } }

// 탭 삭제 리스너
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabAuthors[tabId];
});

// 탭 활성화 리스너 (탭 전환)
chrome.tabs.onActivated.addListener((activeInfo) => {
    const { tabId, windowId } = activeInfo;
    
    // 엠팍 이외의 사이트에서도 활성화 상태 유지
    chrome.tabs.get(tabId, (tab) => {
        if (tab) updateSidePanelState(tabId, tab.url);
    });
    
    // 1. 해당 탭의 캐시된 데이터가 있으면 즉시 전송
    if (tabAuthors[tabId]) {
        chrome.runtime.sendMessage({
            action: 'UPDATE_SIDE_PANEL',
            ...tabAuthors[tabId],
            tabId: tabId, // 캐싱을 위해 탭ID 포함
            windowId: windowId
        }).catch(() => {});
    } else {
        // 2. 캐시가 없으면, 엠팍 페이지인 경우 상태 확인을 트리거하거나 null로 업데이트
        chrome.tabs.get(tabId, (tab) => {
            if (tab && tab.url && tab.url.includes('mlbpark.donga.com')) {
                chrome.tabs.sendMessage(tabId, { action: 'CHECK_PAGE_STATUS' })
                .catch(() => {
                     // 확인 실패 시 빈 상태로 설정
                     chrome.runtime.sendMessage({
                        action: 'UPDATE_SIDE_PANEL',
                        uid: null, nickname: null, profileImage: null, postId: null,
                        tabId: tabId,
                        windowId: windowId
                    }).catch(() => {});
                });
            } else {
                // 엠팍 페이지가 아니거나 작성자 정보가 없으면 패널 초기화
                chrome.runtime.sendMessage({
                    action: 'UPDATE_SIDE_PANEL',
                    uid: null, nickname: null, profileImage: null, postId: null,
                    tabId: tabId,
                    windowId: windowId
                }).catch(() => {});
            }
        });
    }
});

// 탭 업데이트 리스너
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 항상 상태 업데이트 (페이지 이동 시 처리)
  if (changeInfo.url || changeInfo.status === 'loading') {
      updateSidePanelState(tabId, tab.url);
  }

  if (tab.url && tab.url.includes('mlbpark.donga.com') && changeInfo.status === 'complete') {
      chrome.tabs.sendMessage(tabId, { action: 'CHECK_PAGE_STATUS' })
      .catch(() => {});
  }
});

// 사이드 패널 열기를 위한 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openSidePanel',
    title: 'Open 엠팍커(MLBParker)',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidePanel') {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderTabId = sender.tab ? sender.tab.id : null;
  const senderWindowId = sender.tab ? sender.tab.windowId : null;
  const isSenderActive = sender.tab ? sender.tab.active : false;

  if (message.action === 'AUTHOR_UID_DETECTED') {
    const { uid, nickname, profileImage, postId, site } = message;
    
    // 캐시 업데이트
    if (senderTabId) {
        tabAuthors[senderTabId] = { uid, nickname, profileImage, postId, site };
    }

    // 활성화된 탭인 경우에만 스토리지 및 사이드 패널 업데이트
    if (isSenderActive) {
        chrome.storage.local.set({ 
            currentUid: uid,
            currentAuthor: { uid, nickname, profileImage, postId, site }
        });
        
        chrome.runtime.sendMessage({
            action: 'UPDATE_SIDE_PANEL',
            uid, nickname, profileImage, postId, site,
            tabId: senderTabId,
            windowId: senderWindowId
        }).catch(() => {});
    }
  } else if (message.action === 'NO_AUTHOR_DETECTED') {
    if (senderTabId) delete tabAuthors[senderTabId];

    if (isSenderActive) {
        chrome.storage.local.remove(['currentUid', 'currentAuthor']);
        chrome.runtime.sendMessage({
            action: 'UPDATE_SIDE_PANEL',
            uid: null, nickname: null, profileImage: null, postId: null, site: null,
            tabId: senderTabId,
            windowId: senderWindowId
        }).catch(() => {});
    }
  } else if (message.action === 'GET_ACTIVE_TAB_AUTHOR') {
      chrome.tabs.query({ active: true, windowId: message.windowId }, (tabs) => {
          if (tabs && tabs[0] && tabAuthors[tabs[0].id]) {
              sendResponse({ ...tabAuthors[tabs[0].id], tabId: tabs[0].id });
          } else {
              sendResponse(tabs && tabs[0] ? { tabId: tabs[0].id } : null);
          }
      });
      return true; // 비동기 처리
  }
});

// 엠팍 임베딩을 허용하기 위해 X-Frame-Options 및 CSP 헤더 제거
const RULE_ID = 1;

async function setupRules() {
  const rules = [
    {
      id: RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' }
        ]
      },
      condition: {
        urlFilter: 'mlbpark.donga.com',
        resourceTypes: ['sub_frame']
      }
    }
  ];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: rules
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupRules();

  // 기본 설정을 활성화 상태로 설정
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  // 설치 또는 새로고침 시 기존의 모든 탭 상태 업데이트
  chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => updateSidePanelState(tab.id, tab.url));
  });
  
  // 중복 ID 오류를 방지하기 위해 기존 메뉴 삭제
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'openSidePanel',
      title: 'Open MLBPark User Info',
      contexts: ['all']
    });
  });
});

chrome.runtime.onStartup.addListener(setupRules);
