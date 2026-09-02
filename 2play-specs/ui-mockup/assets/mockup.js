(function () {
  document.documentElement.classList.add("js");

  var header = document.querySelector(".app-header");
  var menu = document.querySelector("[data-testid='nav-menu']");
  if (header && menu) {
    menu.addEventListener("click", function () {
      header.classList.toggle("is-nav-open");
    });
  }

  document.querySelectorAll(".day-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".day-tab").forEach(function (t) {
        t.classList.remove("is-on");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-on");
      tab.setAttribute("aria-selected", "true");
      var day = tab.getAttribute("data-day");
      document.querySelectorAll("[data-day-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-day-panel") !== day;
      });
    });
  });

  document.querySelectorAll(".register-card .chip, .chip[data-interest]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      chip.classList.toggle("is-on");
    });
  });

  /* Custom combo: opening always shows ALL options (never filter to current value) */
  function closeAllCombos(except) {
    document.querySelectorAll("[data-combo]").forEach(function (combo) {
      if (except && combo === except) return;
      combo.classList.remove("is-open");
      var list = combo.querySelector(".combo__list");
      var toggle = combo.querySelector(".combo__toggle");
      if (list) list.hidden = true;
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  document.querySelectorAll("[data-combo]").forEach(function (combo) {
    var input = combo.querySelector("input");
    var toggle = combo.querySelector(".combo__toggle");
    var list = combo.querySelector(".combo__list");
    if (!input || !toggle || !list) return;

    function openList() {
      closeAllCombos(combo);
      // Always reveal every option — do not hide non-matching values
      list.querySelectorAll('[role="option"]').forEach(function (opt) {
        opt.parentElement.hidden = false;
        opt.setAttribute("aria-selected", opt.textContent === input.value ? "true" : "false");
      });
      list.hidden = false;
      combo.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    function closeList() {
      list.hidden = true;
      combo.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (list.hidden) openList();
      else closeList();
    });

    list.querySelectorAll('[role="option"]').forEach(function (opt) {
      opt.addEventListener("click", function (e) {
        e.preventDefault();
        input.value = opt.textContent;
        closeList();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
      });
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openList();
      } else if (e.key === "Escape") {
        closeList();
      }
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-combo]")) closeAllCombos();
  });

  /* Validation: only destination + days required */
  var form = document.getElementById("plan-form");
  if (form) {
    function setError(name, message) {
      var field = form.querySelector('[data-field="' + name + '"]');
      if (!field) return;
      var input = field.querySelector("input, select, textarea");
      var err = field.querySelector(".field-error");
      field.classList.toggle("is-invalid", Boolean(message));
      if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
      if (err) {
        err.hidden = !message;
        err.textContent = message || "";
      }
    }

    function clearAll() {
      form.querySelectorAll("[data-field]").forEach(function (f) {
        var n = f.getAttribute("data-field");
        if (n) setError(n, "");
      });
    }

    function validate() {
      clearAll();
      var ok = true;
      var destEl = form.querySelector('[name="dest"]');
      var dest = ((destEl && destEl.value) || "").trim();
      if (!dest) {
        setError("dest", "请填写目的地");
        ok = false;
      } else if (dest.length < 2) {
        setError("dest", "目的地至少 2 个字符");
        ok = false;
      }

      var daysEl = form.querySelector('[name="days"]');
      var days = Number(daysEl && daysEl.value);
      if (!daysEl || !daysEl.value || Number.isNaN(days) || days < 1 || days > 14) {
        setError("days", "天数 1–14");
        ok = false;
      }

      var fromEl = form.querySelector('[name="time_from"]');
      var toEl = form.querySelector('[name="time_to"]');
      if (fromEl && toEl && fromEl.value && toEl.value && fromEl.value >= toEl.value) {
        setError("time_to", "结束须晚于开始");
        ok = false;
      }
      return ok;
    }

    form.addEventListener("submit", function (e) {
      if (!validate()) {
        e.preventDefault();
        var first = form.querySelector(".field.is-invalid input, .field.is-invalid select");
        if (first) first.focus();
      }
    });
  }

  /* Chat height-only resize */
  var shell = document.querySelector("[data-testid='chat-shell'], .chat-shell");
  var grip = document.querySelector("[data-testid='chat-resize'], .chat-resize");
  if (shell && grip) {
    var MIN = 320;
    var dragging = false;
    var startY = 0;
    var startH = 0;
    function maxH() {
      return Math.min(window.innerHeight * 0.7, 640);
    }
    function applyH(px) {
      var h = Math.min(maxH(), Math.max(MIN, px));
      shell.style.setProperty("--chat-h", h + "px");
      shell.style.height = h + "px";
    }
    applyH(shell.getBoundingClientRect().height || 448);
    grip.addEventListener("pointerdown", function (e) {
      dragging = true;
      startY = e.clientY;
      startH = shell.getBoundingClientRect().height;
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      applyH(startH + (e.clientY - startY));
    });
    function endDrag() {
      dragging = false;
    }
    grip.addEventListener("pointerup", endDrag);
    grip.addEventListener("pointercancel", endDrag);
  }

  /* §12 悬浮领航员：左上角拉手拖动调整宽高
     最小宽度 = 当前默认宽度（22.5rem），最小高度 = 调整后的默认高度（45rem） */
  var nav = document.querySelector("[data-testid='plan-nav']");
  var navResize = document.querySelector("[data-testid='plan-nav-resize']");
  if (nav && navResize) {
    var MIN_W = 27 * 16;
    var MIN_H = 45 * 16;
    var navDrag = false;
    var navStartX = 0;
    var navStartY = 0;
    var navStartW = 0;
    var navStartH = 0;
    function navMaxW() { return Math.min(window.innerWidth - 2 * 16, 40 * 16); }
    function navMaxH() { return Math.min(window.innerHeight - 2 * 16, 64 * 16); }
    function applyNavSize(w, h) {
      var nw = Math.min(navMaxW(), Math.max(MIN_W, w));
      var nh = Math.min(navMaxH(), Math.max(MIN_H, h));
      nav.style.width = nw + "px";
      nav.style.height = nh + "px";
    }
    var initRect = nav.getBoundingClientRect();
    applyNavSize(initRect.width || MIN_W, initRect.height || MIN_H);
    navResize.addEventListener("pointerdown", function (e) {
      navDrag = true;
      navStartX = e.clientX;
      navStartY = e.clientY;
      navStartW = nav.getBoundingClientRect().width;
      navStartH = nav.getBoundingClientRect().height;
      navResize.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    navResize.addEventListener("pointermove", function (e) {
      if (!navDrag) return;
      var w = navStartW + (navStartX - e.clientX);
      var h = navStartH + (navStartY - e.clientY);
      applyNavSize(w, h);
    });
    function endNavDrag() { navDrag = false; }
    navResize.addEventListener("pointerup", endNavDrag);
    navResize.addEventListener("pointercancel", endNavDrag);
  }

  /* Replan dialog */
  var openReplan = document.querySelector("[data-testid='replan-open']");
  var backdrop = document.querySelector("[data-testid='replan-dialog']");
  var cancelReplan = document.querySelector("[data-testid='replan-cancel']");
  var confirmReplan = document.querySelector("[data-testid='replan-confirm']");
  function setReplanOpen(open) {
    if (!backdrop) return;
    backdrop.classList.toggle("is-open", open);
    backdrop.setAttribute("aria-hidden", open ? "false" : "true");
  }
  if (openReplan) openReplan.addEventListener("click", function () { setReplanOpen(true); });
  if (cancelReplan) cancelReplan.addEventListener("click", function () { setReplanOpen(false); });
  if (backdrop) {
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) setReplanOpen(false);
    });
  }
  if (confirmReplan) {
    confirmReplan.addEventListener("click", function () {
      setReplanOpen(false);
      var transcript = document.querySelector("[data-testid='chat-transcript'], .chat-transcript");
      if (transcript) {
        var div = document.createElement("div");
        div.className = "bubble bubble--system";
        div.textContent = "已重新规划。上方为之前的对话；下方起对应新行程。";
        transcript.appendChild(div);
        transcript.scrollTop = transcript.scrollHeight;
      }
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      setReplanOpen(false);
      closeAllCombos();
    }
  });

  /* Plan nav open / close */
  var planNav = document.querySelector("[data-testid='plan-nav']");
  var planNavOpenBtn = document.querySelector("[data-testid='plan-nav-open']");
  var planNavCloseBtn = document.querySelector("[data-testid='plan-nav-close']");
  var planNavTerminateBtn = document.querySelector("[data-testid='plan-nav-terminate']");

  function setPlanNavOpen(open) {
    if (!planNav) return;
    planNav.classList.toggle("is-open", open);
    if (planNavOpenBtn) {
      planNavOpenBtn.classList.toggle("is-hidden", open);
      planNavOpenBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    planNav.setAttribute("aria-hidden", open ? "false" : "true");
  }

  if (planNavOpenBtn) {
    planNavOpenBtn.addEventListener("click", function () {
      setPlanNavOpen(true);
    });
  }

  if (planNavCloseBtn) {
    planNavCloseBtn.addEventListener("click", function () {
      setPlanNavOpen(false);
    });
  }

  if (planNavTerminateBtn) {
    planNavTerminateBtn.addEventListener("click", function () {
      setReplanOpen(true);
    });
  }

  if (planNav && planNav.classList.contains("is-open") && planNavOpenBtn) {
    planNavOpenBtn.classList.add("is-hidden");
    planNavOpenBtn.setAttribute("aria-expanded", "true");
  }

  document.querySelectorAll("[data-testid='plan-travel-tips-toggle']").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var section = btn.closest(".plan-travel-tips");
      if (!section) return;
      var collapsed = section.classList.toggle("is-collapsed");
      var expanded = !collapsed;
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      btn.setAttribute("aria-label", expanded ? "隐藏出行小贴士" : "显示出行小贴士");
    });
  });
})();
