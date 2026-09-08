// ==UserScript==
// @name         动态管理
// @namespace    xcnte
// @version      0.40
// @description  动态管理页面
// @author       xcnte
// @match        https://space.bilibili.com/*
// @match        http://space.bilibili.com/*
// @require      https://greasyfork.org/scripts/38220-mscststs-tools/code/MSCSTSTS-TOOLS.js?version=713767
// @require      https://cdn.jsdelivr.net/npm/axios@1.7.3/dist/axios.min.js
// @icon         https://static.hdslb.com/images/favicon.ico
// @license      MIT
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 全局状态
    let appState = {
      showModal: false,
      loading: false,
      loadCount: 20,
      dynamics: [],
      pendingDynamics: [],
      offset: '',
      reachedEnd: false,
      uid: ''
    };

    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    async function init() {
      try {
        if (document.getElementById('dynamic-manager')) {
          return;
        }

        const shijiao = await mscststs.wait(".view-switcher__trigger", false, 100);
        if (!shijiao || !~shijiao.innerText.indexOf("我自己")) {
          console.log('当前不是自己的个人动态');
          return;
        }

        await Promise.all([
          mscststs.wait(".space-dynamic__right")
        ]);

        // 获取用户ID
        appState.uid = getCurrentUid();

        const node = createControlPanel();
        document.querySelector("body").append(node);

        // 绑定事件
        bindEvents();

      } catch (error) {
        console.error('初始化失败:', error);
      }
    }

    // 获取当前用户ID
    function getCurrentUid() {
      const match = window.location.pathname.match(/\/(\d+)/);
      return match ? match[1] : '';
    }

    // 创建控制面板DOM结构
    function createControlPanel() {
      const panelHtml = `
        <div id="dynamic-manager" class="msc_panel" style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
        ">
          <button id="open-manager-btn" style="
            background: linear-gradient(135deg, #00b4d8, #0077b6);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 180, 216, 0.3);
          ">
            📊 动态管理
          </button>

          <!-- 管理面板弹窗 -->
          <div id="manager-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              background: white;
              border-radius: 12px;
              width: 95%;
              max-width: 1400px;
              max-height: 90%;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            ">
              <!-- 头部 -->
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 30px;
                border-bottom: 1px solid #e1e1e1;
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
              ">
                <h2 style="margin: 0; color: #333;">动态管理面板</h2>
                <button id="close-modal-btn" style="
                  background: none;
                  border: none;
                  font-size: 24px;
                  cursor: pointer;
                  color: #666;
                  width: 30px;
                  height: 30px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                  transition: all 0.2s;
                ">×</button>
              </div>

              <!-- 操作区域 -->
              <div style="padding: 20px 30px; border-bottom: 1px solid #e1e1e1;">
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <label style="font-weight: 500; color: #333;">加载数量:</label>
                    <input
                      id="load-count-input"
                      type="number"
                      min="1"
                      max="100"
                      value="20"
                      style="
                        width: 80px;
                        padding: 6px 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                      "
                    >
                  </div>
                  <button
                    id="load-dynamics-btn"
                    style="
                      background: #28a745;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                      transition: all 0.2s;
                    "
                  >
                    加载动态
                  </button>
                  <button
                    id="delete-old-dynamics-btn"
                    disabled
                    title="请先加载动态"
                    style="
                      background: #6f42c1;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: not-allowed;
                      font-size: 14px;
                      margin-right: 10px;
                      opacity: 0.6;
                    "
                  >
                    删除三个月以前的动态
                  </button>
                  <button
                    id="delete-old-forwards-unfollow-btn"
                    disabled
                    title="请先加载动态"
                    style="
                      background: #c0392b;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: not-allowed;
                      font-size: 14px;
                      margin-right: 10px;
                      opacity: 0.6;
                    "
                  >
                    删除三个月前转发并取关
                  </button>
                  <button
                    id="select-all-forward-btn"
                    style="
                      background: #17a2b8;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                      margin-right: 10px;
                    "
                  >
                    勾选所有转发
                  </button>
                  <button
                    id="select-all-lottery-btn"
                    style="
                      background: #fd7e14;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                      margin-right: 10px;
                    "
                  >
                    勾选所有抽奖
                  </button>
                  <button
                    id="batch-delete-btn"
                    style="
                      background: #dc3545;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                      margin-right: 10px;
                    "
                  >
                    批量删除
                  </button>
                  <button
                    id="batch-delete-unfollow-btn"
                    style="
                      background: #e74c3c;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                      margin-right: 10px;
                    "
                  >
                    删除并取关
                  </button>
                  <button
                    id="clear-data-btn"
                    style="
                      background: #dc3545;
                      color: white;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                    "
                  >
                    清空数据
                  </button>
                  <div id="dynamics-count" style="margin-left: auto; color: #666;">
                    已加载: 0 条动态
                  </div>
                </div>
              </div>

              <!-- 表格区域 -->
              <div style="padding: 0; max-height: 600px; overflow-y: auto;">
                <table id="dynamics-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                  <thead style="background: #f8f9fa; position: sticky; top: 0;">
                    <tr>
                      <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-weight: 600; width: 80px;">
                        <input
                          type="checkbox"
                          id="select-all-checkbox"
                          style="margin-right: 8px;"
                        >
                        选择
                      </th>
                      <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-weight: 600; width: 80px;">类型</th>
                      <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-weight: 600; width: 500px;">内容</th>
                      <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-weight: 600; width: 120px;">发布时间</th>
                      <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-weight: 600; width: 120px;">操作</th>
                    </tr>
                  </thead>
                  <tbody id="dynamics-tbody">
                    <tr>
                      <td colspan="5" style="padding: 40px; text-align: center; color: #999;">
                        暂无数据，请点击"加载动态"获取数据
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;

      const div = document.createElement('div');
      div.innerHTML = panelHtml;
      return div.firstElementChild;
    }

    // 绑定事件
    function bindEvents() {
      // 打开弹窗
      document.getElementById('open-manager-btn').addEventListener('click', showModal);

      // 关闭弹窗
      document.getElementById('close-modal-btn').addEventListener('click', hideModal);

      // 点击遮罩关闭弹窗
      document.getElementById('manager-modal').addEventListener('click', function(e) {
        if (e.target === this) {
          hideModal();
        }
      });

      // 加载动态
      document.getElementById('load-dynamics-btn').addEventListener('click', loadDynamics);

      // 删除当前已加载数据中三个月以前的动态
      document.getElementById('delete-old-dynamics-btn').addEventListener('click', deleteOldDynamics);

      // 删除当前已加载数据中三个月以前的转发并取关原作者
      document.getElementById('delete-old-forwards-unfollow-btn').addEventListener('click', deleteOldForwardsAndUnfollow);

      // 勾选所有转发
      document.getElementById('select-all-forward-btn').addEventListener('click', selectAllForward);

      // 勾选所有抽奖
      document.getElementById('select-all-lottery-btn').addEventListener('click', selectAllLottery);

      // 批量删除
      document.getElementById('batch-delete-btn').addEventListener('click', batchDeleteDynamics);

      // 批量删除并取关
      document.getElementById('batch-delete-unfollow-btn').addEventListener('click', batchDeleteAndUnfollowDynamics);

      // 清空数据
      document.getElementById('clear-data-btn').addEventListener('click', clearData);

      // 全选
      document.getElementById('select-all-checkbox').addEventListener('change', toggleAllSelection);

      // 加载数量输入
      document.getElementById('load-count-input').addEventListener('input', function() {
        appState.loadCount = parseInt(this.value) || 20;
      });

      // 按钮悬停效果
      const openBtn = document.getElementById('open-manager-btn');
      openBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-1px)';
        this.style.boxShadow = '0 4px 12px rgba(0, 180, 216, 0.4)';
      });
      openBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 8px rgba(0, 180, 216, 0.3)';
      });

      const closeBtn = document.getElementById('close-modal-btn');
      closeBtn.addEventListener('mouseenter', function() {
        this.style.background = '#f0f0f0';
      });
      closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'none';
      });

    }

    // 显示弹窗
    function showModal() {
      appState.showModal = true;
      document.getElementById('manager-modal').style.display = 'flex';
    }

    // 隐藏弹窗
    function hideModal() {
      appState.showModal = false;
      document.getElementById('manager-modal').style.display = 'none';
    }

    // 加载动态
    async function loadDynamics() {
      if (!appState.uid) {
        alert('无法获取用户ID');
        return;
      }

      const loadBtn = document.getElementById('load-dynamics-btn');
      loadBtn.disabled = true;
      loadBtn.style.opacity = '0.6';
      loadBtn.style.cursor = 'not-allowed';

      const targetCount = Math.min(Math.max(Number(appState.loadCount) || 20, 1), 100);
      let totalLoadedInThisSession = 0;
      let pageRequestCount = 0;

      try {
        // 循环加载直到达到目标数量或没有更多数据
        while (totalLoadedInThisSession < targetCount) {
          loadBtn.textContent = `加载中... (${totalLoadedInThisSession}/${targetCount})`;

          // 先消费上一次接口分页中尚未加入表格的数据，避免小批量加载时跳项。
          if (appState.pendingDynamics.length === 0) {
            if (appState.reachedEnd) {
              break;
            }

            if (pageRequestCount > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            const response = await spaceHistory(appState.offset);
            if (response.code !== 0) {
              alert('加载失败: ' + response.message);
              break;
            }

            const items = response.data?.items || [];
            appState.offset = response.data?.offset || '';
            appState.reachedEnd = items.length === 0 || !response.data?.has_more || !appState.offset;
            pageRequestCount++;

            if (items.length === 0) {
              console.log('没有更多动态数据');
              break;
            }

            appState.pendingDynamics.push(...items);
          }

          const remainingCount = targetCount - totalLoadedInThisSession;
          const candidates = appState.pendingDynamics.splice(0, remainingCount);
          const existingIds = new Set(appState.dynamics.map(item => item.id_str));
          const itemsToAdd = candidates.filter(item => {
            if (existingIds.has(item.id_str)) {
              return false;
            }
            existingIds.add(item.id_str);
            return true;
          }).map(item => ({ ...item, selected: false }));

          appState.dynamics.push(...itemsToAdd);
          totalLoadedInThisSession += itemsToAdd.length;

          console.log(`本次加载 ${itemsToAdd.length} 条动态，累计加载 ${totalLoadedInThisSession} 条`);
        }

        if (appState.reachedEnd && appState.pendingDynamics.length === 0) {
          console.log('已加载所有可用的动态数据');
        }

        console.log(`加载完成，目标: ${targetCount} 条，实际加载: ${totalLoadedInThisSession} 条，总计: ${appState.dynamics.length} 条`);

        // 更新UI
        updateDynamicsTable();
        updateDynamicsCount();

        // 显示加载结果
        if (totalLoadedInThisSession > 0) {
          const message = totalLoadedInThisSession < targetCount && appState.reachedEnd
            ? `成功加载 ${totalLoadedInThisSession} 条动态（已加载完所有可用数据）`
            : `成功加载 ${totalLoadedInThisSession} 条动态`;
          console.log(message);
        } else {
          alert('没有新的动态数据');
        }

      } catch (error) {
        console.error('加载动态失败:', error);
        alert('加载失败，请检查网络连接');
      } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = '加载动态';
        loadBtn.style.opacity = '1';
        loadBtn.style.cursor = 'pointer';
      }
    }

    // API调用
    async function spaceHistory(offset = "", retryCount = 0) {
      const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?offset=${encodeURIComponent(offset)}&host_mid=${encodeURIComponent(appState.uid)}&timezone_offset=-480&platform=web`;

      try {
        const response = await axios.get(url, {
          withCredentials: true
        });
        return response.data;
      } catch (error) {
        if (error.response?.status === 429 && retryCount < 3) {
          const retryDelay = 2000 * (retryCount + 1);
          console.warn(`请求过于频繁，${retryDelay / 1000} 秒后进行第 ${retryCount + 1} 次重试`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return spaceHistory(offset, retryCount + 1);
        }
        throw error;
      }
    }

    // 清空数据
    function clearData() {
      if (confirm('确定要清空所有数据吗？')) {
        appState.dynamics = [];
        appState.pendingDynamics = [];
        appState.offset = '';
        appState.reachedEnd = false;
        updateDynamicsTable();
        updateDynamicsCount();
      }
    }

    // 全选/取消全选
    function toggleAllSelection() {
      const checkbox = document.getElementById('select-all-checkbox');
      const isChecked = checkbox.checked;

      appState.dynamics.forEach(item => {
        item.selected = isChecked;
      });

      // 更新表格中的复选框
      const itemCheckboxes = document.querySelectorAll('.item-checkbox');
      itemCheckboxes.forEach(cb => {
        cb.checked = isChecked;
      });
    }

    // 将接口文本安全地放入 innerHTML 和 HTML 属性
    function escapeHtml(value) {
      const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return String(value ?? '').replace(/[&<>"']/g, char => replacements[char]);
    }

    // 更新动态表格
    function updateDynamicsTable() {
      const tbody = document.getElementById('dynamics-tbody');

      if (appState.dynamics.length === 0) {
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="padding: 40px; text-align: center; color: #999;">
              暂无数据，请点击"加载动态"获取数据
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = appState.dynamics.map((item, index) => {
        const archive = item?.modules?.module_dynamic?.major?.archive;
        const typeLabel = escapeHtml(getTypeLabel(item));
        const contentTitle = escapeHtml(getContentTitle(item));
        const contentDesc = escapeHtml(getContentDesc(item));
        const publishTime = escapeHtml(item?.modules?.module_author?.pub_time || '未知时间');
        const coverHtml = archive?.cover
          ? `<img src="${escapeHtml(archive.cover)}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">`
          : '';

        return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px;">
            <input
              type="checkbox"
              class="item-checkbox"
              data-index="${index}"
              ${item.selected ? 'checked' : ''}
              style="margin-right: 8px;"
            >
            ${index + 1}
          </td>
          <td style="padding: 12px;">
            <span style="
              display: inline-block;
              padding: 2px 8px;
              background: #e3f2fd;
              color: #1976d2;
              border-radius: 12px;
              font-size: 12px;
              white-space: nowrap;
            ">
              ${typeLabel}
            </span>
          </td>
          <td style="padding: 12px; word-wrap: break-word; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${coverHtml}
              <div style="overflow: hidden; flex: 1; min-width: 0;">
                <div style="font-weight: 500; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${contentTitle}">
                  ${contentTitle}
                </div>
                <div style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${contentDesc}">
                  ${contentDesc}
                </div>
              </div>
            </div>
          </td>
          <td style="padding: 12px; color: #666; font-size: 14px; white-space: nowrap;">
            ${publishTime}
          </td>
          <td style="padding: 12px;">
            <div style="display: flex; gap: 8px;">
              <button
                class="view-btn"
                data-index="${index}"
                style="
                  background: #007bff;
                  color: white;
                  border: none;
                  padding: 4px 8px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 12px;
                  white-space: nowrap;
                "
              >
                查看
              </button>
              <button
                class="delete-btn"
                data-index="${index}"
                style="
                  background: #dc3545;
                  color: white;
                  border: none;
                  padding: 4px 8px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 12px;
                  white-space: nowrap;
                "
              >
                删除
              </button>
              <button
                class="delete-unfollow-btn"
                data-index="${index}"
                style="
                  background: #e74c3c;
                  color: white;
                  border: none;
                  padding: 4px 6px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 12px;
                  white-space: nowrap;
                "
              >
                删除并取关
              </button>
            </div>
          </td>
        </tr>
      `;
      }).join('');

      // 绑定表格内的事件
      bindTableEvents();

      const selectAllCheckbox = document.getElementById('select-all-checkbox');
      const allSelected = appState.dynamics.every(item => item.selected);
      const someSelected = appState.dynamics.some(item => item.selected);
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }

    // 绑定表格内的事件
    function bindTableEvents() {
      // 绑定复选框事件
      document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          const index = parseInt(this.dataset.index);
          appState.dynamics[index].selected = this.checked;

          // 更新全选复选框状态
          const allSelected = appState.dynamics.every(item => item.selected);
          const someSelected = appState.dynamics.some(item => item.selected);
          const selectAllCheckbox = document.getElementById('select-all-checkbox');
          selectAllCheckbox.checked = allSelected;
          selectAllCheckbox.indeterminate = someSelected && !allSelected;
        });
      });

      // 绑定查看按钮事件
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          viewDynamic(appState.dynamics[index]);
        });
      });

      // 绑定删除按钮事件
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          deleteDynamic(appState.dynamics[index]);
        });
      });

      // 绑定删除并取关按钮事件
      document.querySelectorAll('.delete-unfollow-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          deleteAndUnfollowDynamic(appState.dynamics[index]);
        });
      });
    }

    // 更新动态数量显示
    function updateDynamicsCount() {
      document.getElementById('dynamics-count').textContent = `已加载: ${appState.dynamics.length} 条动态`;

      const hasLoadedDynamics = appState.dynamics.length > 0;
      const loadedDataActions = [
        {
          button: document.getElementById('delete-old-dynamics-btn'),
          title: '仅删除当前已加载数据中三个月以前的动态'
        },
        {
          button: document.getElementById('delete-old-forwards-unfollow-btn'),
          title: '仅处理当前已加载数据中三个月以前的转发，并取关原作者'
        }
      ];

      loadedDataActions.forEach(({ button, title }) => {
        button.disabled = !hasLoadedDynamics;
        button.style.opacity = hasLoadedDynamics ? '1' : '0.6';
        button.style.cursor = hasLoadedDynamics ? 'pointer' : 'not-allowed';
        button.title = hasLoadedDynamics ? title : '请先加载动态';
      });
    }

    // 勾选所有转发动态
    function selectAllForward() {
      let forwardCount = 0;

      appState.dynamics.forEach(item => {
        if (item.type === 'DYNAMIC_TYPE_FORWARD') {
          item.selected = true;
          forwardCount++;
        }
      });

      if (forwardCount === 0) {
        alert('暂无转发动态');
        return;
      }

      // 更新表格中的复选框
      const itemCheckboxes = document.querySelectorAll('.item-checkbox');
      itemCheckboxes.forEach((cb, index) => {
        if (appState.dynamics[index] && appState.dynamics[index].type === 'DYNAMIC_TYPE_FORWARD') {
          cb.checked = true;
        }
      });

      // 更新全选复选框状态
      const allSelected = appState.dynamics.every(item => item.selected);
      const someSelected = appState.dynamics.some(item => item.selected);
      const selectAllCheckbox = document.getElementById('select-all-checkbox');
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;

      alert(`已勾选 ${forwardCount} 条转发动态`);
    }

    // 勾选所有抽奖动态
    function selectAllLottery() {
      let lotteryCount = 0;

      appState.dynamics.forEach(item => {
        // 检查是否是转发抽奖动态
        if (item.type === 'DYNAMIC_TYPE_FORWARD' &&
            item.orig &&
            item.orig.modules &&
            item.orig.modules.module_dynamic &&
            item.orig.modules.module_dynamic.additional &&
            item.orig.modules.module_dynamic.additional.type === 'ADDITIONAL_TYPE_UPOWER_LOTTERY') {
          item.selected = true;
          lotteryCount++;
        }
      });

      if (lotteryCount === 0) {
        alert('暂无抽奖动态');
        return;
      }

      // 更新表格中的复选框
      const itemCheckboxes = document.querySelectorAll('.item-checkbox');
      itemCheckboxes.forEach((cb, index) => {
        const item = appState.dynamics[index];
        if (item && item.type === 'DYNAMIC_TYPE_FORWARD' &&
            item.orig &&
            item.orig.modules &&
            item.orig.modules.module_dynamic &&
            item.orig.modules.module_dynamic.additional &&
            item.orig.modules.module_dynamic.additional.type === 'ADDITIONAL_TYPE_UPOWER_LOTTERY') {
          cb.checked = true;
        }
      });

      // 更新全选复选框状态
      const allSelected = appState.dynamics.every(item => item.selected);
      const someSelected = appState.dynamics.some(item => item.selected);
      const selectAllCheckbox = document.getElementById('select-all-checkbox');
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;

      alert(`已勾选 ${lotteryCount} 条抽奖动态`);
    }

    // 获取类型标签
    function getTypeLabel(item) {
      const type = item.type;

      // 处理转发动态
      if (type === 'DYNAMIC_TYPE_FORWARD') {
        if (item.orig && item.orig.modules && item.orig.modules.module_dynamic) {
          const origDynamic = item.orig.modules.module_dynamic;
          // 检查是否是转发抽奖
          if (origDynamic.additional && origDynamic.additional.type === 'ADDITIONAL_TYPE_UPOWER_LOTTERY') {
            return '转发抽奖';
          }
        }
        return '转发';
      }

      const typeMap = {
        'DYNAMIC_TYPE_AV': '视频',
        'DYNAMIC_TYPE_WORD': '文字',
        'DYNAMIC_TYPE_DRAW': '图片',
        'DYNAMIC_TYPE_ARTICLE': '文章',
        'DYNAMIC_TYPE_MUSIC': '音频',
        'DYNAMIC_TYPE_COMMON_SQUARE': '分享',
        'DYNAMIC_TYPE_LIVE': '直播',
        'DYNAMIC_TYPE_LIVE_RCMD': '直播推荐'
      };

      return typeMap[type] || '其他';
    }

    // 获取内容标题
    function getContentTitle(item) {
      // 处理转发动态
      if (item.type === 'DYNAMIC_TYPE_FORWARD') {
        if (item.modules.module_dynamic.desc && item.modules.module_dynamic.desc.text) {
          return `${item.modules.module_dynamic.desc.text}`;
        }
        // 如果转发没有文字，显示转发的原动态标题
        if (item.orig) {
          const origTitle = getOriginalContentTitle(item.orig);
          return `转发：${origTitle}`;
        }
        return '转发动态';
      }

      // 处理视频动态
      if (item.modules.module_dynamic.major && item.modules.module_dynamic.major.archive) {
        return item.modules.module_dynamic.major.archive.title;
      }

      // 处理图片动态
      if (item.modules.module_dynamic.major && item.modules.module_dynamic.major.opus) {
        if (item.modules.module_dynamic.major.opus.summary) {
          return item.modules.module_dynamic.major.opus.summary.text || '图片动态';
        }
      }

      // 处理文字动态
      if (item.modules.module_dynamic.desc && item.modules.module_dynamic.desc.text) {
        return item.modules.module_dynamic.desc.text;
      }

      return '无标题';
    }

    // 获取原动态的标题（用于转发）
    function getOriginalContentTitle(origItem) {
      if (origItem.modules.module_dynamic.major && origItem.modules.module_dynamic.major.archive) {
        return origItem.modules.module_dynamic.major.archive.title;
      }
      if (origItem.modules.module_dynamic.major && origItem.modules.module_dynamic.major.opus) {
        if (origItem.modules.module_dynamic.major.opus.summary) {
          return origItem.modules.module_dynamic.major.opus.summary.text || '图片动态';
        }
      }
      if (origItem.modules.module_dynamic.desc && origItem.modules.module_dynamic.desc.text) {
        return origItem.modules.module_dynamic.desc.text;
      }
      return '动态内容';
    }

    // 获取内容描述
    function getContentDesc(item) {
      // 处理转发动态
      if (item.type === 'DYNAMIC_TYPE_FORWARD' && item.orig) {
        return getOriginalContentDesc(item.orig);
      }

      // 处理视频动态
      if (item.modules.module_dynamic.major && item.modules.module_dynamic.major.archive) {
        return item.modules.module_dynamic.major.archive.desc || '';
      }

      // 处理图片动态描述
      if (item.modules.module_dynamic.major && item.modules.module_dynamic.major.opus) {
        return '图片动态';
      }

      return '';
    }

    // 获取原动态的描述（用于转发）
    function getOriginalContentDesc(origItem) {
      if (origItem.modules.module_dynamic.major && origItem.modules.module_dynamic.major.archive) {
        return origItem.modules.module_dynamic.major.archive.desc || '';
      }
      if (origItem.modules.module_dynamic.major && origItem.modules.module_dynamic.major.opus) {
        return '图片动态';
      }
      return '';
    }

    // 查看动态
    function viewDynamic(item) {
      // 处理视频动态
      if (item.modules.module_dynamic.major && item.modules.module_dynamic.major.archive) {
        window.open(item.modules.module_dynamic.major.archive.jump_url, '_blank');
        return;
      }

      // 处理转发动态
      if (item.type === 'DYNAMIC_TYPE_FORWARD' && item.orig) {
        // 如果原动态是视频，跳转到视频
        if (item.orig.modules.module_dynamic.major && item.orig.modules.module_dynamic.major.archive) {
          window.open(item.orig.modules.module_dynamic.major.archive.jump_url, '_blank');
          return;
        }
        // 如果原动态是图片，跳转到图文
        if (item.orig.modules.module_dynamic.major && item.orig.modules.module_dynamic.major.opus) {
          window.open(item.orig.modules.module_dynamic.major.opus.jump_url, '_blank');
          return;
        }
        // 跳转到原动态
        window.open(`https://t.bilibili.com/${item.orig.id_str}`, '_blank');
        return;
      }

      // 处理图片动态
      if (item.modules.module_dynamic.major && item.modules.module_dynamic.major.opus) {
        window.open(item.modules.module_dynamic.major.opus.jump_url, '_blank');
        return;
      }

      // 默认跳转到动态页面
      window.open(`https://t.bilibili.com/${item.id_str}`, '_blank');
    }

    // 获取CSRF token
    function getCSRFToken() {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'bili_jct') {
          return value;
        }
      }
      return '';
    }

    // 删除动态
    async function deleteDynamic(item) {
      const title = getContentTitle(item);
      if (!confirm(`确定要删除这条动态吗？\n${title}`)) {
        return;
      }

      try {
        // 获取删除参数
        const deleteParams = item.modules.module_more.three_point_items.find(
          item => item.type === 'THREE_POINT_DELETE'
        );

        if (!deleteParams || !deleteParams.params) {
          alert('无法获取删除参数');
          return;
        }

        const { dyn_id_str, dyn_type, rid_str } = deleteParams.params;
        const csrf = getCSRFToken();

        if (!csrf) {
          alert('未登录或获取CSRF token失败，请先登录B站');
          return;
        }

        // 调用删除API
        const response = await fetch(
          `https://api.bilibili.com/x/dynamic/feed/operate/remove?platform=web&csrf=${csrf}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': '*/*',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'include',
            body: JSON.stringify({
              dyn_id_str,
              dyn_type,
              rid_str
            })
          }
        );

        const result = await response.json();

        if (result.code === 0) {
          alert('删除成功！');
          // 从本地数据中移除该动态
          const index = appState.dynamics.findIndex(d => d.id_str === item.id_str);
          if (index > -1) {
            appState.dynamics.splice(index, 1);
            updateDynamicsTable();
            updateDynamicsCount();
          }
        } else {
          alert(`删除失败: ${result.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('删除失败:', error);
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          alert('删除失败：网络连接错误或跨域问题');
        } else {
          alert(`删除失败: ${error.message}`);
        }
      }
    }

    // 获取若干个日历月以前的日期，兼容月底日期
    function getMonthsAgoDate(months) {
      const now = new Date();
      const originalDay = now.getDate();
      const cutoffDate = new Date(now);

      cutoffDate.setDate(1);
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      const lastDayOfTargetMonth = new Date(
        cutoffDate.getFullYear(),
        cutoffDate.getMonth() + 1,
        0
      ).getDate();
      cutoffDate.setDate(Math.min(originalDay, lastDayOfTargetMonth));

      return cutoffDate;
    }

    // 获取动态发布时间戳；无有效时间戳时返回 null，防止误删
    function getDynamicPublishTimestamp(item) {
      const timestamp = Number(item?.modules?.module_author?.pub_ts);
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }

    // 获取需要取关的作者；转发动态取原作者，其他动态取动态作者
    function getUnfollowTarget(item) {
      const author = item?.type === 'DYNAMIC_TYPE_FORWARD'
        ? item?.orig?.modules?.module_author
        : item?.modules?.module_author;
      const uid = author?.mid;

      if (uid === undefined || uid === null || uid === '') {
        return null;
      }

      return {
        uid: String(uid),
        name: author.name || String(uid)
      };
    }

    // 删除当前已加载数据中三个月以前的动态
    async function deleteOldDynamics() {
      if (appState.dynamics.length === 0) {
        alert('请先点击“加载动态”获取数据');
        return;
      }

      const cutoffDate = getMonthsAgoDate(3);
      const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);
      const oldItems = appState.dynamics.filter(item => {
        const publishTimestamp = getDynamicPublishTimestamp(item);
        return publishTimestamp !== null && publishTimestamp < cutoffTimestamp;
      });
      const invalidTimeCount = appState.dynamics.filter(
        item => getDynamicPublishTimestamp(item) === null
      ).length;

      if (oldItems.length === 0) {
        let message = `当前已加载的 ${appState.dynamics.length} 条动态中，没有 ${cutoffDate.toLocaleString()} 以前的动态。`;
        if (invalidTimeCount > 0) {
          message += `\n另有 ${invalidTimeCount} 条动态缺少有效发布时间，已安全跳过。`;
        }
        message += '\n如需检查更早的内容，请继续加载动态后再试。';
        alert(message);
        return;
      }

      let confirmMessage = `本次只检查当前已加载的 ${appState.dynamics.length} 条动态。\n`;
      confirmMessage += `将删除其中 ${oldItems.length} 条早于 ${cutoffDate.toLocaleString()} 的动态。`;
      if (invalidTimeCount > 0) {
        confirmMessage += `\n${invalidTimeCount} 条缺少有效发布时间的动态将被跳过。`;
      }
      confirmMessage += '\n\n删除后无法恢复，确定继续吗？';

      await deleteDynamicItems(
        oldItems,
        document.getElementById('delete-old-dynamics-btn'),
        confirmMessage,
        '三个月以前的动态删除完成！'
      );
    }

    // 删除当前已加载数据中三个月以前的转发，并取关原动态作者
    async function deleteOldForwardsAndUnfollow() {
      if (appState.dynamics.length === 0) {
        alert('请先点击“加载动态”获取数据');
        return;
      }

      const cutoffDate = getMonthsAgoDate(3);
      const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);
      const loadedForwards = appState.dynamics.filter(
        item => item.type === 'DYNAMIC_TYPE_FORWARD'
      );
      const oldForwards = loadedForwards.filter(item => {
        const publishTimestamp = getDynamicPublishTimestamp(item);
        return publishTimestamp !== null && publishTimestamp < cutoffTimestamp;
      });
      const invalidTimeCount = loadedForwards.filter(
        item => getDynamicPublishTimestamp(item) === null
      ).length;

      if (oldForwards.length === 0) {
        let message = `当前已加载的 ${appState.dynamics.length} 条动态中，没有 ${cutoffDate.toLocaleString()} 以前的转发。`;
        if (invalidTimeCount > 0) {
          message += `\n另有 ${invalidTimeCount} 条转发缺少有效发布时间，已安全跳过。`;
        }
        message += '\n如需检查更早的内容，请继续加载动态后再试。';
        alert(message);
        return;
      }

      const uniqueTargetUids = new Set();
      let missingTargetCount = 0;
      oldForwards.forEach(item => {
        const target = getUnfollowTarget(item);
        if (!target) {
          missingTargetCount++;
        } else if (target.uid !== appState.uid) {
          uniqueTargetUids.add(target.uid);
        }
      });

      let confirmMessage = `本次只检查当前已加载的 ${appState.dynamics.length} 条动态。\n`;
      confirmMessage += `将删除其中 ${oldForwards.length} 条早于 ${cutoffDate.toLocaleString()} 的转发，`;
      confirmMessage += `并尝试取关 ${uniqueTargetUids.size} 个原作者。`;
      if (invalidTimeCount > 0) {
        confirmMessage += `\n${invalidTimeCount} 条缺少有效发布时间的转发将被跳过。`;
      }
      if (missingTargetCount > 0) {
        confirmMessage += `\n${missingTargetCount} 条转发无法识别原作者：仍会删除动态，但不会取关。`;
      }
      confirmMessage += '\n\n删除与取关操作无法恢复，确定继续吗？';

      await deleteAndUnfollowItems(
        oldForwards,
        document.getElementById('delete-old-forwards-unfollow-btn'),
        confirmMessage,
        '三个月以前的转发处理完成！'
      );
    }

    // 批量删除所勾选的动态
    async function batchDeleteDynamics() {
      const selectedItems = appState.dynamics.filter(item => item.selected);

      if (selectedItems.length === 0) {
        alert('请先选择要删除的动态');
        return;
      }

      await deleteDynamicItems(
        selectedItems,
        document.getElementById('batch-delete-btn'),
        `确定要删除选中的 ${selectedItems.length} 条动态吗？此操作无法撤销！`,
        '批量删除完成！'
      );
    }

    // 共用的批量删除流程
    async function deleteDynamicItems(items, batchBtn, confirmMessage, completionTitle) {
      if (!confirm(confirmMessage)) {
        return;
      }

      const csrf = getCSRFToken();
      if (!csrf) {
        alert('未登录或获取CSRF token失败，请先登录B站');
        return;
      }

      const originalText = batchBtn.textContent;
      let successCount = 0;
      let failCount = 0;

      try {
        batchBtn.disabled = true;
        batchBtn.style.opacity = '0.6';
        batchBtn.style.cursor = 'not-allowed';

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          batchBtn.textContent = `删除中... (${i + 1}/${items.length})`;

          try {
            const deleteParams = item?.modules?.module_more?.three_point_items?.find(
              menuItem => menuItem.type === 'THREE_POINT_DELETE'
            );

            if (!deleteParams || !deleteParams.params) {
              console.warn(`动态 ${item.id_str} 无法获取删除参数`);
              failCount++;
              continue;
            }

            const { dyn_id_str, dyn_type, rid_str } = deleteParams.params;
            const response = await fetch(
              `https://api.bilibili.com/x/dynamic/feed/operate/remove?platform=web&csrf=${csrf}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': '*/*',
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                },
                credentials: 'include',
                body: JSON.stringify({
                  dyn_id_str,
                  dyn_type,
                  rid_str
                })
              }
            );

            const result = await response.json();
            if (result.code === 0) {
              successCount++;
              const index = appState.dynamics.findIndex(d => d.id_str === item.id_str);
              if (index > -1) {
                appState.dynamics.splice(index, 1);
              }
            } else {
              console.error(`删除动态 ${item.id_str} 失败:`, result.message);
              failCount++;
            }
          } catch (error) {
            console.error(`删除动态 ${item.id_str} 出错:`, error);
            failCount++;
          }

          if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        updateDynamicsTable();
        updateDynamicsCount();

        let message = `${completionTitle}\n成功: ${successCount} 条`;
        if (failCount > 0) {
          message += `\n失败: ${failCount} 条`;
        }
        alert(message);
      } catch (error) {
        console.error('批量删除失败:', error);
        alert(`批量删除失败: ${error.message}`);
      } finally {
        batchBtn.disabled = false;
        batchBtn.style.opacity = '1';
        batchBtn.style.cursor = 'pointer';
        batchBtn.textContent = originalText;
        // 删除后可能已经没有已加载数据，重新同步旧动态按钮状态。
        updateDynamicsCount();
      }
    }

    // 批量删除并取关
    async function batchDeleteAndUnfollowDynamics() {
      const selectedItems = appState.dynamics.filter(item => item.selected);

      if (selectedItems.length === 0) {
        alert('请先选择要删除的动态');
        return;
      }

      await deleteAndUnfollowItems(
        selectedItems,
        document.getElementById('batch-delete-unfollow-btn'),
        `确定要删除选中的 ${selectedItems.length} 条动态并取关对应的用户吗？此操作无法撤销！`,
        '批量操作完成！'
      );
    }

    // 共用的批量删除并取关流程
    async function deleteAndUnfollowItems(selectedItems, batchBtn, confirmMessage, completionTitle) {
      if (!confirm(confirmMessage)) {
        return;
      }

      const csrf = getCSRFToken();
      if (!csrf) {
        alert('未登录或获取CSRF token失败，请先登录B站');
        return;
      }

      const originalText = batchBtn.textContent;

      let deleteSuccessCount = 0;
      let unfollowSuccessCount = 0;
      let deleteFailCount = 0;
      let unfollowFailCount = 0;
      let unfollowSkippedCount = 0;
      const processedUsers = new Set(); // 记录已处理的用户，避免重复取关

      try {
        batchBtn.disabled = true;
        batchBtn.style.opacity = '0.6';
        batchBtn.style.cursor = 'not-allowed';

        for (let i = 0; i < selectedItems.length; i++) {
          const item = selectedItems[i];
          batchBtn.textContent = `处理中... (${i + 1}/${selectedItems.length})`;

          try {
            // 获取删除参数
            const deleteParams = item?.modules?.module_more?.three_point_items?.find(
              menuItem => menuItem.type === 'THREE_POINT_DELETE'
            );

            if (!deleteParams || !deleteParams.params) {
              console.warn(`动态 ${item.id_str} 无法获取删除参数`);
              deleteFailCount++;
              continue;
            }

            const { dyn_id_str, dyn_type, rid_str } = deleteParams.params;

            // 调用删除API
            const deleteResponse = await fetch(
              `https://api.bilibili.com/x/dynamic/feed/operate/remove?platform=web&csrf=${csrf}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': '*/*',
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                },
                credentials: 'include',
                body: JSON.stringify({
                  dyn_id_str,
                  dyn_type,
                  rid_str
                })
              }
            );

            const deleteResult = await deleteResponse.json();

            if (deleteResult.code === 0) {
              deleteSuccessCount++;

              // 删除成功后尝试取关目标作者；同一作者只操作一次
              const target = getUnfollowTarget(item);
              if (!target || target.uid === appState.uid) {
                unfollowSkippedCount++;
              } else if (!processedUsers.has(target.uid)) {
                processedUsers.add(target.uid);

                const unfollowResult = await unfollowUser(target.uid);
                if (unfollowResult.success) {
                  unfollowSuccessCount++;
                  console.log(`成功取关用户 ${target.name} (${target.uid})`);
                } else {
                  unfollowFailCount++;
                  console.warn(`取关用户 ${target.name} (${target.uid}) 失败: ${unfollowResult.message}`);
                }

                // 添加取关操作间的延迟
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              // 从本地数据中移除该动态
              const index = appState.dynamics.findIndex(d => d.id_str === item.id_str);
              if (index > -1) {
                appState.dynamics.splice(index, 1);
              }
            } else {
              console.error(`删除动态 ${item.id_str} 失败:`, deleteResult.message);
              deleteFailCount++;
            }
          } catch (error) {
            console.error(`处理动态 ${item.id_str} 出错:`, error);
            deleteFailCount++;
          }

          // 添加延迟避免请求过于频繁
          if (i < selectedItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // 更新UI
        updateDynamicsTable();
        updateDynamicsCount();

        // 显示结果
        let message = `${completionTitle}\n删除动态成功: ${deleteSuccessCount} 条\n取关用户成功: ${unfollowSuccessCount} 个`;
        if (deleteFailCount > 0) {
          message += `\n删除失败: ${deleteFailCount} 条`;
        }
        if (unfollowFailCount > 0) {
          message += `\n取关失败: ${unfollowFailCount} 个`;
        }
        if (unfollowSkippedCount > 0) {
          message += `\n无法识别作者或作者为自己，跳过取关: ${unfollowSkippedCount} 条`;
        }
        alert(message);

      } catch (error) {
        console.error('批量删除并取关失败:', error);
        alert(`批量操作失败: ${error.message}`);
      } finally {
        batchBtn.disabled = false;
        batchBtn.style.opacity = '1';
        batchBtn.style.cursor = 'pointer';
        batchBtn.textContent = originalText;
        updateDynamicsCount();
      }
    }

    // 取关用户
    async function unfollowUser(uid) {
      const csrf = getCSRFToken();
      if (!csrf) {
        throw new Error('未登录或获取CSRF token失败');
      }

      try {
        const formData = new URLSearchParams();
        formData.append('act', '2'); // 2表示取消关注
        formData.append('fid', uid.toString());
        formData.append('spmid', '333.1365');
        formData.append('re_src', '0');
        formData.append('csrf', csrf);

        const response = await fetch(
          'https://api.bilibili.com/x/relation/modify?statistics=%7B%22appId%22:100,%22platform%22:5%7D',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': '*/*',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'include',
            body: formData
          }
        );

        const result = await response.json();

        if (result.code === 0) {
          return { success: true };
        } else {
          return { success: false, message: result.message || '取关失败' };
        }
      } catch (error) {
        return { success: false, message: error.message };
      }
    }

    // 删除并取关动态
    async function deleteAndUnfollowDynamic(item) {
      const title = getContentTitle(item);
      let targetAuthorName = item.modules.module_author.name;
      let targetAuthorUid = item.modules.module_author.mid;

      // 如果是转发动态，获取原动态的作者信息
      if (item.type === 'DYNAMIC_TYPE_FORWARD' && item.orig && item.orig.modules && item.orig.modules.module_author) {
        targetAuthorName = item.orig.modules.module_author.name;
        targetAuthorUid = item.orig.modules.module_author.mid;
      }

      if (!confirm(`确定要删除这条动态并取关 "${targetAuthorName}" 吗？\n动态：${title}`)) {
        return;
      }

      try {
        // 先删除动态
        const deleteParams = item.modules.module_more.three_point_items.find(
          item => item.type === 'THREE_POINT_DELETE'
        );

        if (!deleteParams || !deleteParams.params) {
          alert('无法获取删除参数');
          return;
        }

        const { dyn_id_str, dyn_type, rid_str } = deleteParams.params;
        const csrf = getCSRFToken();

        if (!csrf) {
          alert('未登录或获取CSRF token失败，请先登录B站');
          return;
        }

        // 调用删除API
        const deleteResponse = await fetch(
          `https://api.bilibili.com/x/dynamic/feed/operate/remove?platform=web&csrf=${csrf}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': '*/*',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'include',
            body: JSON.stringify({
              dyn_id_str,
              dyn_type,
              rid_str
            })
          }
        );

        const deleteResult = await deleteResponse.json();

        if (deleteResult.code === 0) {
          // 删除成功，尝试取关目标作者

          // 检查是否是自己的动态，如果是则跳过取关
          if (targetAuthorUid.toString() === appState.uid) {
            alert('删除成功！（跳过取关自己）');
          } else {
            const unfollowResult = await unfollowUser(targetAuthorUid);

            if (unfollowResult.success) {
              alert(`删除动态并取关 "${targetAuthorName}" 成功！`);
            } else {
              alert(`删除动态成功，但取关失败: ${unfollowResult.message}`);
            }
          }

          // 从本地数据中移除该动态
          const index = appState.dynamics.findIndex(d => d.id_str === item.id_str);
          if (index > -1) {
            appState.dynamics.splice(index, 1);
            updateDynamicsTable();
            updateDynamicsCount();
          }
        } else {
          alert(`删除失败: ${deleteResult.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('删除并取关失败:', error);
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          alert('操作失败：网络连接错误或跨域问题');
        } else {
          alert(`操作失败: ${error.message}`);
        }
      }
    }

  })();
