// ==UserScript==
// @name         云上河开 全自动推进器
// @namespace    local.yunshangheka.autopilot
// @version      1.1.2
// @description  1x自动播放 + 自动关完成弹窗 + 自动跳下一个资源
// @match        *://*.open.ha.cn/jxpt-web/student/activity/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var CFG = {
    rate: 1,
    muted: true,
    docWait: 45000,
    endedWait: 40000,
    skipTask: true,
    poll: 2000
  };

  var S = {
    player: null,
    hasVideo: false,
    jumped: false,
    startedAt: Date.now(),
    endedAt: 0,
    paused: false
  };

  /* ================= 工具 ================= */
  function tree() {
    try {
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.zTree) {
        return window.jQuery.fn.zTree.getZTreeObj('courseContent');
      }
    } catch (e) {}
    return null;
  }

  function flat(nodes, out) {
    out = out || [];
    (nodes || []).forEach(function (n) {
      out.push(n);
      if (n.children && n.children.length) flat(n.children, out);
    });
    return out;
  }

  function isTask(n) {
    var name = String(n.name || '');
    var icon = String(n.icon || '');
    if (/job|forum|exam|test/i.test(icon)) return true;
    if (/作业|测验|讨论|考试|测试|提问/.test(name)) return true;
    return false;
  }

  function nextUrl() {
    var t = tree();
    if (!t) return null;
    var all = flat(t.getNodes(), []);
    var usable = all.filter(function (n) {
      if (!n.url) return false;
      if (CFG.skipTask && isTask(n)) return false;
      return true;
    });
    var cur = '';
    try { cur = new URLSearchParams(location.search).get('activityId') || ''; } catch (e) {}
    var idx = -1;
    for (var i = 0; i < usable.length; i++) {
      if (usable[i].id === cur) { idx = i; break; }
    }
    if (idx < 0) return null;
    var nx = usable[idx + 1];
    return nx ? nx.url : null;
  }

  function go(reason) {
    if (S.jumped) return;
    var u = nextUrl();
    if (!u) {
      say('⚠️ 没有下一个资源了（可能全部刷完）', 0);
      return;
    }
    S.jumped = true;
    say('➡️ 跳转：' + reason, 1);
    setTimeout(function () { location.href = u; }, 700);
  }

  /* ================= 视频 ================= */
  function video() {
    return document.querySelector('video.vjs-tech') || document.querySelector('video');
  }

  function play() {
    var v = video();
    if (!v) return;
    if (v !== S.player) {
      S.player = v;
      S.hasVideo = true;
      say('▶️ 已接管视频 ' + Math.round(v.duration || 0) + 's', 1);
    }
    if (CFG.muted) v.muted = true;
    if (v.paused && !v.ended) { try { v.play(); } catch (e) {} }
    if (Math.abs(v.playbackRate - CFG.rate) > 0.01) {
      try { v.playbackRate = CFG.rate; } catch (e) {}
    }
    if (v.ended && !S.endedAt) S.endedAt = Date.now();
    if (!v.ended) S.endedAt = 0;
  }

  /* ================= 弹窗 ================= */
  function dialogDone() {
    var d = document.querySelector('.layui-layer-dialog');
    if (!d) return false;
    var t = d.textContent || '';
    return /已完成当前资源|已学习完毕|学习完毕|已完成/.test(t);
  }

  function handleDialog() {
    if (S.jumped) return;
    var b0 = document.querySelector('.layui-layer-btn0');
    say('✅ 检测到完成弹窗', 1);
    if (b0) {
      try { b0.click(); } catch (e) {}
      setTimeout(function () {
        if (!S.jumped) go('弹窗确定后未跳转');
      }, 2500);
    } else {
      go('弹窗无确定按钮');
    }
  }

  /* ================= 面板 ================= */
  function say(msg, ok) {
    var el = document.getElementById('hk-auto-st');
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok === 1 ? '#2a9d8f' : (ok === 0 ? '#e76f51' : '#e9c46a');
  }

  function panel() {
    if (document.getElementById('hk-auto-panel')) return;
    var p = document.createElement('div');
    p.id = 'hk-auto-panel';
    p.innerHTML =
      '<div class="hk-a-h">河开全自动 <span id="hk-auto-st">初始化</span></div>' +
      '<label class="hk-a-l"><input type="checkbox" id="hk-a-skip"' + (CFG.skipTask ? ' checked' : '') + '> 跳过作业/测验</label>' +
      '<div class="hk-a-b"><button id="hk-a-go">下一个</button><button id="hk-a-pause">暂停</button></div>';
    document.body.appendChild(p);

    var s = document.createElement('style');
    s.textContent =
      '#hk-auto-panel{position:fixed;right:16px;top:120px;z-index:2147483647;background:rgba(18,24,31,.96);color:#e8eef4;font:12px/1.6 system-ui,sans-serif;padding:9px 11px;border-radius:8px;width:186px;box-shadow:0 4px 18px rgba(0,0,0,.5)}' +
      '#hk-auto-panel .hk-a-h{font-weight:600;color:#e9c46a;margin-bottom:5px}' +
      '#hk-auto-panel #hk-auto-st{display:block;font-weight:400;font-size:11px;color:#8fa3b5;margin-top:2px;word-break:break-all}' +
      '#hk-auto-panel .hk-a-l{display:flex;align-items:center;gap:4px;margin:5px 0;cursor:pointer}' +
      '#hk-auto-panel .hk-a-b{display:flex;gap:6px}' +
      '#hk-auto-panel button{flex:1;background:#2a9d8f;color:#fff;border:0;border-radius:4px;padding:3px;cursor:pointer;font-size:11px}' +
      '#hk-auto-panel button:hover{background:#248077}';
    document.head.appendChild(s);

    document.getElementById('hk-a-skip').onchange = function (e) {
      CFG.skipTask = e.target.checked;
      try { localStorage.setItem('hk_skip_task', e.target.checked ? '1' : '0'); } catch (er) {}
      say('跳过作业/测验：' + (e.target.checked ? '开' : '关'), 2);
    };
    document.getElementById('hk-a-go').onclick = function () {
      S.jumped = false;
      go('手动');
    };
    document.getElementById('hk-a-pause').onclick = function () {
      S.paused = !S.paused;
      this.textContent = S.paused ? '继续' : '暂停';
      say(S.paused ? '⏸ 已暂停' : '▶️ 已恢复', S.paused ? 0 : 1);
    };
  }

  /* ================= 主循环 ================= */
  try {
    var saved = localStorage.getItem('hk_skip_task');
    if (saved !== null) CFG.skipTask = saved === '1';
  } catch (e) {}

  panel();

  setInterval(function () {
    if (S.paused) return;

    play();

    if (dialogDone()) { handleDialog(); return; }

    if (S.jumped) return;

    /* 无视频页面 */
    if (!S.hasVideo) {
      var wait = Date.now() - S.startedAt;
      if (wait > CFG.docWait) {
        go('无视频页面超时');
      } else {
        say('文档/其他资源，等待 ' + Math.round((CFG.docWait - wait) / 1000) + 's', 2);
      }
      return;
    }

    /* 视频结束：等弹窗，40 秒没来就跳 */
    if (S.endedAt) {
      var edMs = Date.now() - S.endedAt;
      if (edMs > CFG.endedWait) {
        go('播完后 ' + Math.round(CFG.endedWait / 1000) + 's 无弹窗');
      } else {
        say('视频已播完，等弹窗 ' + Math.round(edMs / 1000) + 's / ' + Math.round(CFG.endedWait / 1000) + 's', 2);
      }
      return;
    }

    var v = S.player;
    if (v) {
      var cur = Math.floor(v.currentTime || 0);
      var dur = Math.floor(v.duration || 0);
      say('播放中 ' + cur + 's / ' + dur + 's', 1);
    }
  }, CFG.poll);

  say('已启动，等待视频', 1);
  console.log('%c[全自动] 已启动 v1.0', 'color:#2a9d8f;font-weight:bold');
})();
