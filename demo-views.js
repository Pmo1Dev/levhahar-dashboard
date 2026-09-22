// Compact-card project list layout - an additive overlay loaded alongside
// the shared engine (engine.js/engine.css), not a modification of it, so
// it's safe to include or drop per-site independently. Adds a compact
// "mini bar" row in front of each real .project-card (already rendered by
// engine.js's own renderProjects() by the time this script runs, since
// it's a later <script> tag), using this client's own real DATA and the
// engine's own already-loaded helper functions (statusPill,
// isActiveProject, scheduleColor, etc. - all plain top-level functions in
// engine.js, so they're on window already).
// renderProjects() by the time this script runs, since it's a later
// <script> tag), using this client's own real DATA and the engine's own
// already-loaded helper functions (statusPill, isActiveProject,
// scheduleColor, etc. - all plain top-level functions in engine.js, so
// they're on window already).
//
// Earlier rounds of this demo also included two alternative layouts (a
// compact list, a grouped grid) behind a mode switcher, and animated the
// mini-bar/card swap open and closed. Both were removed per direct client
// request: the compact card is the only layout worth pursuing further, and
// the open/close animation - after three different implementations, each
// with its own real, hard-to-reproduce bug (a CSS transition that silently
// got stuck, a height measurement thrown off by a hidden absolutely-
// positioned panel, a visible "jump" from animating two elements at once) -
// was replaced with a plain instant swap, matching how the real production
// card already opens and closes (which has never had this problem, because
// it does not animate its own open/close either).
(function(){
  const entries = visibleChronologicalEntries();

  // Same "exclude milestones" convention already used for the real card's
  // own "שלבים"/"קריטיים" KPI tiles - a milestone isn't a real phase.
  function phaseCounts(p){
    const real = (p.phases||[]).filter(ph => !ph.milestone);
    return { total: real.length, critical: real.filter(ph => ph.critical).length };
  }
  function monthsOf(p){
    return (daysBetween(parseDate(p.start), parseDate(p.finish)) / 30.44).toFixed(0);
  }
  function pctOf(p){ return Math.round(p.overallActualPct ?? 0); }
  function plannedPctOf(p){ return Math.round(p.overallPlannedPct ?? 0); }
  function phaseName(p){ return p.nextTask ? p.nextTask.name : '-'; }
  function activityLabel(p){ return isActiveProject(p) ? 'בביצוע' : isFutureProject(p) ? 'בתכנון' : 'הסתיים'; }
  // Same delta the real card's own "פער מהתכנון" note shows.
  function deltaOf(p){ return (p.overallActualPct ?? 0) - (p.overallPlannedPct ?? 0); }
  function deltaLabel(p){ const d = deltaOf(p); return `${d>=0?'+':''}${d.toFixed(1)}%`; }
  // Same "% מסך הפרויקטים" denominator the real KPI tile's own duration
  // sub-label uses - total calendar days across every currently-active
  // project, matching renderProjects()'s own totalActiveDuration exactly.
  const totalActiveDuration = entries.filter(([,p]) => isActiveProject(p))
    .reduce((s,[,p]) => s + daysBetween(parseDate(p.start), parseDate(p.finish)), 0);
  function durationSharePct(p){
    if(!totalActiveDuration) return 0;
    return (daysBetween(parseDate(p.start), parseDate(p.finish)) / totalActiveDuration * 100).toFixed(1);
  }
  // Same denominator convention as durationSharePct above, applied to
  // budget instead of duration - matches renderProjects()'s own
  // budgetWeightPct exactly.
  const totalActiveBudget = entries.filter(([,p]) => isActiveProject(p))
    .reduce((s,[,p]) => s + (p.budget||0), 0);
  function budgetWeightPct(p){
    if(!totalActiveBudget) return '0.0';
    return (p.budget/totalActiveBudget*100).toFixed(1);
  }
  function budgetUtilPct(p){
    return p.budget > 0 ? (p.ac/p.budget*100).toFixed(1) : (p.ac > 0 ? '100.0' : '0.0');
  }

  const projectsEl = document.getElementById('projects');
  document.body.classList.add('demo-compact-active');
  // engine.js's own renderProjects() always builds a search/sort/filter
  // toolbar (#projects-toolbar) and a status-filter row (#projects-filter-
  // bar) above the list, INCLUDING its own separate "open all/close all"
  // button (#toggle-all-btn). An earlier round hid both entirely, because
  // none of them were adapted for this compact layout: they all act on
  // `.project-card` directly (search/sort/filter via updateVisibility()/
  // the sort <select>'s own change handler, the button via a plain
  // classList.toggle()), completely bypassing the mini bar's own
  // demo-mini-open/demo-mini-hidden state and the bar/card sibling pairing
  // this file maintains. The client asked for search/sort/filter back -
  // real, useful controls for a 20-project list - so instead of hiding
  // them, this keeps them and adds the missing sync in both directions:
  // - search box input / a filter chip click hides or shows a
  //   `.project-card` (native behavior, untouched) - the corresponding
  //   `.demo-mini-bar` needs the same visibility, or a filtered-out
  //   project's mini bar would keep showing even though its card is gone.
  // - the sort <select> reorders `.project-card` elements in the DOM
  //   (native behavior, untouched) - each bar needs to move to just before
  //   its own card again afterwards, or the visible mini-bar order stops
  //   matching the sort entirely (bars stay in their original order since
  //   nothing told them to move).
  // The one native control still hidden on purpose is #toggle-all-btn -
  // it's a plain classList.toggle() with no animation and no bar-hiding of
  // its own, i.e. exactly the earlier desync bug's actual source; the
  // client's own floating "פתח הכל" button (see fabBar below) already does
  // this correctly and fully replaces it.
  const nativeToolbar = document.getElementById('projects-toolbar');
  const nativeFilterBar = document.getElementById('projects-filter-bar');
  const nativeToggleAllBtn = document.getElementById('toggle-all-btn');
  if(nativeToggleAllBtn) nativeToggleAllBtn.style.display = 'none';
  // Purely cosmetic: engine.js inserts these as two separate, stacked
  // elements - wrapping both in one flex row (wrapping onto a second line
  // only if the window is too narrow to fit everything) reads as a single,
  // standard "sort & filter" toolbar instead of two disconnected bars, and
  // a small label makes its purpose explicit at a glance.
  if(nativeToolbar && nativeFilterBar){
    const wrap = document.createElement('div');
    wrap.className = 'demo-toolbar-wrap';
    nativeToolbar.parentNode.insertBefore(wrap, nativeToolbar);
    const label = document.createElement('div');
    label.className = 'demo-toolbar-label';
    label.textContent = 'מיון וסינון';
    wrap.appendChild(label);
    wrap.appendChild(nativeToolbar);
    wrap.appendChild(nativeFilterBar);
  }

  const miniHead = document.createElement('div');
  miniHead.className = 'demo-mini-head';
  const anyShowsFinancials = entries.some(([,p]) => projectShowsFinancials(p));
  // demo-mini-identity: a top line at chevron/pin height holding [pin]
  // [status] [type] (status to the pin's left, type to status's left), then
  // the project title starting directly below the PIN's own right edge
  // (not the chevron's), then dates below the title - client's own precise
  // spec, replacing the previous "one slash-separated line + flag opposite
  // it" layout entirely. The pace flag (update date + pill) is now its own
  // separate block at the far end of the whole row (the true top-left
  // corner of the row, past every tile) - also a precise client correction
  // of an earlier round's "keep it near the title" placement.
  miniHead.innerHTML = `
    <span class="demo-mini-col-chevron"></span>
    <span class="demo-mini-identity">
      <span>סטטוס / סוג / שם פרויקט</span>
    </span>
    <span class="demo-mini-col-progress demo-mini-tile-head">התקדמות</span>
    <span class="demo-mini-col-phases demo-mini-tile-head">שלבים</span>
    <span class="demo-mini-col-duration demo-mini-tile-head">משך</span>
    ${anyShowsFinancials ? `
    <span class="demo-mini-col-budget demo-mini-tile-head">תקציב</span>
    <span class="demo-mini-col-spent demo-mini-tile-head">נוצל בפועל</span>
    <span class="demo-mini-col-remaining demo-mini-tile-head">יתרה</span>
    ` : ''}
    <span class="demo-mini-col-phase">שלב נוכחי</span>
    <span class="demo-mini-col-flag">קצב</span>
  `;
  const realCards = [...projectsEl.querySelectorAll('.project-card')];
  if(realCards[0]) realCards[0].parentNode.insertBefore(miniHead, realCards[0]);

  // engine.js's own real card title is "${index}. ${p.title}" (a fixed,
  // one-time render-order number baked into .pc-title-text) - once sort,
  // filter and pin can all reorder the list, that number stops meaning
  // anything (a pinned or sorted-to-the-top project can still show "3."
  // from its original chronological spot), so it's stripped back out to
  // plain text here. This is demo-only for now: the numbering itself lives
  // in the SHARED engine.js template, used by every client, most of which
  // don't have sort/pin/filter reordering the list the way this compact
  // view does - client's own explicit call, pending a decision on whether
  // to also fix it at the engine.js level for every client later.
  realCards.forEach(card => {
    const titleText = card.querySelector('.pc-title-text');
    if(titleText) titleText.textContent = titleText.textContent.replace(/^\d+\.\s*/, '');
  });

  // Every {bar, card} pair, so the "open all / close all" button below can
  // act on all of them at once.
  const allRows = [];

  realCards.forEach(card => {
    const key = card.dataset.key;
    const p = DATA[key];
    if(!p) return;
    const bar = document.createElement('div');
    bar.className = 'demo-mini-bar';
    const counts = phaseCounts(p);
    const delta = deltaOf(p);
    // Same value/color source as the real card's own progress-track metric
    // (scheduleColor is the exact top-level helper the real card uses for
    // this - see engine.js's own renderProjectCard) so the mini tile's bar
    // always agrees with the full card's.
    const barColor = scheduleColor(delta);
    const showFin = projectShowsFinancials(p);
    // Real edge-case bug found in this round's review: projectShowsFinancials
    // is a PER-PROJECT override (engine.js's own documented feature - e.g.
    // one project in an otherwise financial portfolio that hides its own
    // budget). anyShowsFinancials (above) is portfolio-wide and decides
    // whether the HEADER row shows the budget/spent/remaining column labels
    // at all - it says nothing about any one row. Before this fix, a single
    // project with showFin false (while anyShowsFinancials stayed true
    // because every OTHER project still shows financials) simply omitted
    // its own 3 budget tiles entirely, which shifted that row's own
    // "שלב נוכחי"/"קצב" columns ~324px out of alignment with every other
    // row and with the header - confirmed by measurement (removing the 3
    // budget tiles from one row moved its own phase-column offset by
    // exactly 3*(100px tile + 8px gap), while every other row stayed put).
    // Doesn't affect the CURRENT real demo data (all 7 projects show
    // financials uniformly, so anyShowsFinancials/showFin never disagree
    // today) but this is a documented, supported per-project field a client
    // could set at any time - rendering 3 dashed placeholder tiles (same
    // width/gap as the real ones) instead of nothing keeps every row's
    // columns aligned regardless.
    const budgetTilesHTML = showFin ? `
      <span class="demo-mini-col-budget demo-mini-tile">
        <span class="demo-mini-num ltr-num">${fmtMoneyM(p.budget)}</span>
        <span class="demo-mini-sub ltr-num">${budgetWeightPct(p)}% מהתיק</span>
      </span>
      <span class="demo-mini-col-spent demo-mini-tile">
        <span class="demo-mini-num ltr-num">${fmtMoneyM(p.ac)}</span>
        <span class="demo-mini-sub ltr-num">${budgetUtilPct(p)}% ניצול</span>
      </span>
      <span class="demo-mini-col-remaining demo-mini-tile">
        <span class="demo-mini-num ltr-num">${fmtMoneyM(p.budget - p.ac)}</span>
        <span class="demo-mini-sub ltr-num">${(100-parseFloat(budgetUtilPct(p))).toFixed(1)}% מהתקציב</span>
      </span>
    ` : (anyShowsFinancials ? `
      <span class="demo-mini-col-budget demo-mini-tile"><span class="demo-mini-sub">אין נתון</span></span>
      <span class="demo-mini-col-spent demo-mini-tile"><span class="demo-mini-sub">אין נתון</span></span>
      <span class="demo-mini-col-remaining demo-mini-tile"><span class="demo-mini-sub">אין נתון</span></span>
    ` : '');
    bar.innerHTML = `
      <span class="demo-mini-col-chevron demo-compact-chevron" aria-hidden="true">›</span>
      <span class="demo-mini-identity">
        <span class="demo-mini-identity-topline">
          <button type="button" class="demo-mini-pin" aria-label="נעץ פרויקט זה למעלה" title="נעץ למעלה">📌</button>
          <span class="activity-pill">${activityLabel(p)}</span>
          <span class="demo-mini-type-text" title="${p.type}">${p.type}</span>
        </span>
        <span class="demo-mini-title-toprow">
          <span class="demo-mini-title-box"${p.infoSheet ? ' data-has-info="1"' : ''}>
            <span class="demo-mini-title-main" title="${p.title}">${p.title}</span>
            ${p.infoSheet ? projectInfoSheetHTML(p) : ''}
          </span>
          ${p.infoSheet ? '<span class="pc-title-info-icon" tabindex="0" aria-label="מידע נוסף על הפרויקט">i</span>' : ''}
        </span>
        <span class="demo-mini-title-dates ltr-num">${formatDateIL(p.finish)} - ${formatDateIL(p.start)}</span>
      </span>
      <span class="demo-mini-col-progress demo-mini-tile">
        <span class="demo-mini-num ltr-num">${pctOf(p)}%</span>
        <span class="demo-progress-track">
          <span class="demo-progress-fill" style="width:${pctOf(p)}%; background:${barColor};"></span>
          <span class="demo-progress-marker" style="right:${plannedPctOf(p)}%"></span>
        </span>
        <span class="demo-mini-sub ltr-num">מתוכנן ${plannedPctOf(p)}%</span>
        <span class="demo-mini-sub ltr-num" style="color:${barColor}">פער: ${deltaLabel(p)}</span>
      </span>
      <span class="demo-mini-col-phases demo-mini-tile">
        <span class="demo-mini-num">${counts.total}</span>
        <span class="demo-mini-sub">${counts.critical} קריטיים</span>
      </span>
      <span class="demo-mini-col-duration demo-mini-tile">
        <span class="demo-mini-num ltr-num"><span class="demo-duration-unit-full">חוד'</span><span class="demo-duration-unit-short">ח'</span> ${monthsOf(p)}</span>
        <span class="demo-mini-sub ltr-num">${durationSharePct(p)}% מהתיק</span>
      </span>
      ${budgetTilesHTML}
      <span class="demo-mini-col-phase" title="${phaseName(p)}">${phaseName(p)}</span>
      <span class="demo-mini-col-flag">
        <span class="demo-mini-updated ltr-num">עדכון אחרון: ${formatDateIL(projectLastUpdated(p))}</span>
        ${statusPill(p)}
      </span>
    `;
    // Client's own explicit re-ask, both orientations: the chevron used to
    // float as its own absolutely-positioned circle in the card's top
    // corner (the "outside the grid" comment used to live here) - now
    // moved into .demo-mini-title-toprow, right before the title itself,
    // so it sits inline next to the project name instead (this needs an
    // actual DOM move, not just new CSS - the two elements start out
    // several nesting levels apart, and CSS alone can't reposition
    // something across containers like that). DOM-first in this RTL
    // layout = rightmost, so this insertion order alone is what puts the
    // chevron to the title's right, matching the ask directly.
    const chevronEl = bar.querySelector('.demo-mini-col-chevron');
    const titleBox = bar.querySelector('.demo-mini-title-box');
    if(chevronEl && titleBox) titleBox.parentNode.insertBefore(chevronEl, titleBox);
    // Accessibility gap found in this round's review: the mini-bar is the
    // ONLY way to expand a project into its full card (there's no other
    // control that does it), but as a plain <div> with a click listener it
    // was completely unreachable by keyboard - no tab stop, no way to
    // "press" it with Enter/Space. The pin button and info icon are already
    // real focusable controls (a <button> and a tabindex="0" span) and were
    // already fine; this was the one gap. role="button"+tabindex="0" makes
    // it a real tab stop with the right semantics; the keydown listener
    // below (Enter/Space, the two keys native buttons themselves activate
    // on) makes it actually operable, not just reachable.
    bar.setAttribute('role', 'button');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('aria-label', `פתיחת פרטי הפרויקט: ${p.title}`);
    card.parentNode.insertBefore(bar, card);

    const detail = card.querySelector('.detail');
    // Plain instant swap - no animation. This went through three different
    // animated implementations across three rounds (a CSS transition, then
    // two different Web Animations API versions, each time fixing a real
    // bug found in testing: a stuck transition, a wrong height measurement,
    // a non-mirrored close). Each fix was verified as correct - and each
    // time, real usage surfaced a NEW problem anyway (this last round's
    // report: the jump got WORSE, plus a separate bug specifically when
    // opening/closing several rows at once via "open all"). Continuing to
    // chase this was exactly the kind of loop the client asked not to get
    // stuck in. A plain instant swap is what the real production card
    // ALREADY does for its own open/close (see engine.js's own click
    // listener on .project-card, a few lines below) - it has never once
    // had a jump/bug report in this entire project, which is a much
    // stronger track record than three attempts at animating this. If a
    // softer feel is wanted again later, worth trying as its own small,
    // isolated experiment - not layered back onto everything else at once.
    function openFully(){
      card.classList.add('demo-mini-open', 'open');
      bar.classList.add('demo-mini-hidden');
      if(detail) detail.classList.add('open');
      card.style.display = 'block';
      applyRowOrder();
    }
    function collapseToMini(){
      // Real asymmetry found in this round's review: openFully() (above)
      // adds BOTH 'demo-mini-open' and 'open' to card, plus 'open' to
      // detail - but this function only ever removed 'demo-mini-open',
      // never the other two. Invisible when closing happens through a real
      // click ON THE CARD, since engine.js's own native listener (which
      // runs first, before this file's) already toggles card's 'open' -
      // and detail's along with it - back off correctly on its own by the
      // time this function runs; the gap only actually shows up on the
      // path that calls collapseToMini() DIRECTLY, bypassing that native
      // toggle entirely - the floating "open all"/"סגור הכל" button (see
      // fabBar below), which acts on every row's collapseToMini() straight,
      // with no card click in between. Confirmed by testing: after using
      // that button to close every row, every card was left with 'open'
      // (and its own .detail with 'open') stuck true forever, despite being
      // fully collapsed and display:none - not visibly broken with today's
      // engine.js (its own listener always re-derives the correct class
      // before anything reads it), but a real latent inconsistency that a
      // future engine.js change reading this class directly could expose.
      // Removing both here too keeps this function a true mirror of
      // openFully(), regardless of which path (click vs. this function
      // called directly) got a row here.
      card.classList.remove('demo-mini-open', 'open');
      if(detail) detail.classList.remove('open');
      bar.classList.remove('demo-mini-hidden');
      // Real bug found in this round's review: syncMiniBarsToFilter() (see
      // below) sets bar.style.display DIRECTLY (inline), not just via the
      // demo-mini-hidden class, for an open card that still passes the
      // current search/filter (its own "else if(...demo-mini-open...)"
      // branch: card shown, bar inline-hidden). If a search/filter change
      // ever fires while this row is open, that inline 'none' is left
      // sitting on the bar - clearing demo-mini-hidden above does nothing
      // for it, since that class was never what hid it in that case. Without
      // resetting the inline style here too, closing the card afterwards
      // (via this same row's own click-to-close, or "open all"/"close all")
      // left the bar stuck invisible forever - matching a project that's
      // supposedly visible and un-opened just vanishing from the list until
      // the user happened to touch search/filter again. Safe to always
      // clear it here unconditionally: collapseToMini() only ever runs on a
      // row that WAS open, and syncMiniBarsToFilter() already force-closes
      // any open row the moment it stops matching the current search/filter
      // - so by the time a user or "close all" can actually collapse an
      // open row by hand, it is guaranteed to still be passing whatever
      // search/filter is active right now, and clearing the inline style
      // (falling back to the stylesheet's plain display:flex) is exactly
      // the correct resulting state.
      bar.style.display = '';
      card.style.display = 'none';
      applyRowOrder();
    }
    bar.addEventListener('click', openFully);
    // Keyboard counterpart to the click listener above, for the
    // role="button"/tabindex="0" added at creation time (see there for why).
    // Guarded to e.target===bar (not e.currentTarget, which is always bar
    // for a listener attached directly to it - this checks where the key
    // actually landed): the pin button and info icon are both descendants of
    // bar and are already independently focusable, real interactive
    // elements, so a keydown on either of THEM would still bubble up to
    // this same listener - without the guard, pressing Enter/Space while
    // the PIN button has focus would both toggle the pin (its own native
    // button behavior) AND open the card (this listener firing too), which
    // is not what a keyboard user pressing Enter on the pin button wants.
    // Only a keydown on the bar's own empty space (i.e. it itself has
    // focus) should open the card - exactly mirroring what a click there
    // already does, since nothing else in the bar catches a plain click
    // either.
    bar.addEventListener('keydown', (e) => {
      if(e.target !== bar) return;
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
        e.preventDefault();
        openFully();
      }
    });
    // stopPropagation so clicking the pin doesn't also open the card
    // (the bar's own click listener, just above, would otherwise fire
    // too, since this button is a descendant of the bar). applyRowOrder
    // and pinnedKeys are both declared further down in this file - fine to
    // reference here since this callback only actually RUNS on a real
    // click, long after the whole script (including those declarations)
    // has finished executing once, top to bottom.
    const pinBtn = bar.querySelector('.demo-mini-pin');
    // Accessibility nit found in this round's review: aria-label/title were
    // a static "נעץ למעלה" ("pin to top") regardless of whether the row was
    // already pinned - a screen-reader user had no way to tell, from the
    // label alone, whether activating this control would pin or unpin.
    // Kept in sync on every toggle below, matching the existing
    // demo-mini-pin-active visual state.
    function setPinLabel(pinned){
      const label = pinned ? 'בטל נעיצה' : 'נעץ פרויקט זה למעלה';
      pinBtn.setAttribute('aria-label', label);
      pinBtn.setAttribute('title', pinned ? 'בטל נעיצה' : 'נעץ למעלה');
    }
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pinned = pinnedKeys.has(key);
      pinnedKeys[pinned ? 'delete' : 'add'](key);
      pinBtn.classList.toggle('demo-mini-pin-active', !pinned);
      setPinLabel(!pinned);
      applyRowOrder();
    });
    // engine.js's own renderProjects() already put a click listener on this
    // SAME .project-card (added when the card was first rendered, before
    // this script ever ran) that toggles .open on the card + its .detail on
    // any click not caught by a more specific handler (a phase row, the
    // info icon, anything inside .detail - all call stopPropagation). This
    // one runs after that native toggle and just re-syncs the mini bar's
    // own visibility to match: .open present means fully expanded, .open
    // absent means back to the mini bar.
    card.addEventListener('click', () => {
      if(card.classList.contains('open')) openFully();
      else collapseToMini();
    });
    allRows.push({ card, bar, openFully, collapseToMini });
  });

  // ---------- Sync the mini bars to search/filter/sort ----------
  // engine.js's own search box and status-filter chips decide pass/fail by
  // setting `card.style.display` to '' (passes) or 'none' (fails) on every
  // `.project-card`, unconditionally - INCLUDING a card this file currently
  // has open (display:block via openFully()). Left alone, a search that
  // still matches an OPEN card would clear that inline style back to ''
  // (technically "pass"), which - since this file's own CSS gives
  // `.project-card` a default of display:none with no class-based override
  // - would make an open card vanish; a search that stops matching a MINI
  // (not open) card leaves the card correctly invisible either way, but
  // says nothing about its bar, which stays visible with no connection to
  // the filter at all. This reconciles both after every search/filter
  // change: an open card that no longer matches is collapsed for real
  // (not left in a hidden-but-still-"open" state); a card that still
  // matches keeps whatever state it already had, with its OWN display
  // re-asserted if the native code just cleared it.
  function syncMiniBarsToFilter(){
    allRows.forEach(({ card, bar }) => {
      const passes = card.style.display !== 'none';
      if(!passes){
        if(card.classList.contains('demo-mini-open')){
          card.classList.remove('demo-mini-open', 'open');
          const detail = card.querySelector('.detail');
          if(detail) detail.classList.remove('open');
          // openFully() adds this class to the bar (its OWN normal
          // "hidden while its card is open" mechanism) - clearing it here
          // too, not just the classes above, was the actual bug: without
          // it, this bar stayed stuck with display:none from CSS
          // (.demo-mini-bar.demo-mini-hidden) even after the filter
          // later cleared and this same function set bar.style.display=''
          // for it - an inline '' falls back to the STYLESHEET, and the
          // leftover class was still there to catch it.
          bar.classList.remove('demo-mini-hidden');
        }
        card.style.display = 'none';
        bar.style.display = 'none';
      } else if(card.classList.contains('demo-mini-open')){
        card.style.display = 'block';
        bar.style.display = 'none';
      } else {
        card.style.display = 'none';
        bar.style.display = '';
      }
    });
  }
  const nativeSearch = document.getElementById('project-search');
  if(nativeSearch) nativeSearch.addEventListener('input', syncMiniBarsToFilter);
  if(nativeFilterBar) nativeFilterBar.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', syncMiniBarsToFilter));

  // engine.js's own sort <select> reorders `.project-card` elements via
  // repeated container.appendChild(card) calls - it has no idea this file's
  // mini bars exist, so they stay in their original order while the
  // (invisible, unless open) cards move underneath them. This re-attaches
  // each bar directly before its own card, in the cards' OWN now-current
  // order, restoring the bar-then-card pairing (and therefore the visible
  // mini-bar order) to match.
  function syncBarOrderToCards(){
    const ordered = [...projectsEl.querySelectorAll('.project-card')].map(card => allRows.find(r => r.card === card));
    ordered.forEach(row => { if(row) projectsEl.insertBefore(row.bar, row.card); });
    return ordered.filter(Boolean);
  }
  const nativeSort = document.getElementById('project-sort');
  // engine.js's own sort <select> has no alphabetical option - two are added
  // here (ascending + descending, client request), appended after
  // nativeSort's own fixed set of options rather than touching the SHARED
  // engine's own markup for it. An earlier version of this also reworded
  // the default "מיון: כרונולוגי" option and added a separate "מיון:" label
  // beside the select - the client asked for that specific part reverted
  // ("תחזיר למצב הקודם"), so nativeSort's own default option text is left
  // completely untouched here. Direction is shown with a plain arrow glyph
  // instead of "(עולה)"/"(יורד)" text, per the client's own explicit request.
  if(nativeSort){
    const alphaAsc = document.createElement('option');
    alphaAsc.value = 'alpha-asc';
    alphaAsc.textContent = 'א-ב ↑';
    const alphaDesc = document.createElement('option');
    alphaDesc.value = 'alpha-desc';
    alphaDesc.textContent = 'א-ב ↓';
    nativeSort.appendChild(alphaAsc);
    nativeSort.appendChild(alphaDesc);
  }
  function sortAlphabetically(direction){
    const sorted = [...allRows].sort((a, b) => {
      const cmp = a.bar.querySelector('.demo-mini-title-main').textContent
        .localeCompare(b.bar.querySelector('.demo-mini-title-main').textContent, 'he');
      return direction === 'desc' ? -cmp : cmp;
    });
    sorted.forEach(({ bar, card }) => { projectsEl.appendChild(bar); projectsEl.appendChild(card); });
    return sorted;
  }
  if(nativeSort) nativeSort.addEventListener('change', () => {
    // engine.js's own change handler (attached first, so it already ran by
    // the time this fires) does not recognize 'alpha-asc'/'alpha-desc' - it
    // falls through its own if/else chain into a harmless no-op reorder
    // (re-appending every card in its current order, unchanged). This does
    // the actual alphabetical sort itself when one of those is selected,
    // and the usual bar-to-card resync otherwise - either way, currentOrder
    // (see the pin section below) is updated to match, and a pinned row is
    // then put back at the very top regardless of what either sort just did.
    if(nativeSort.value === 'alpha-asc') currentOrder = sortAlphabetically('asc');
    else if(nativeSort.value === 'alpha-desc') currentOrder = sortAlphabetically('desc');
    else currentOrder = syncBarOrderToCards();
    applyRowOrder();
  });

  // ---------- Pin a project to the top, immune to sort/search/filter ----------
  // A pinned row's OWN position is fixed at the very top of the list - any
  // later sort (native or the alphabetical one above) still reorders
  // everything else beneath it, but applyRowOrder() (called after every
  // sort change) always pulls pinned rows back to the front afterwards.
  // Search/filter are unaffected by pinning on purpose - they only ever
  // hide/show a row, never reorder the list, so there's nothing for
  // pinning to override there; a pinned row that doesn't match a search
  // still hides like any other, which is the client's own goal ("a
  // project I want to always see first when it's visible"), not "always
  // visible no matter what I searched for".
  // currentOrder always reflects "the order every row would be in if NO row
  // were pinned" - starts out as the cards' own natural chronological order
  // (same as allRows, built in that order above), and is reassigned
  // wholesale every time a sort actually runs (see the sort <select>'s
  // change listener above). applyRowOrder() below rebuilds the ENTIRE list
  // from this array every time - pinned rows first, then everything else in
  // currentOrder's own order - rather than only moving pinned rows to the
  // front and leaving the rest wherever they last happened to sit. That's
  // what makes un-pinning actually restore a row to where it was before it
  // got pinned: the earlier version had nothing recording that original
  // spot, so removing a key from pinnedKeys left its row sitting at the top
  // instead of moving it back (client-reported bug).
  let currentOrder = allRows.slice();
  const pinnedKeys = new Set();
  // Landscape phones only: an opened (non-pinned) row also sorts to the
  // top, same idea as pinning but automatic and temporary - client's own
  // report that opening the 2nd/3rd card left it rendering BELOW the
  // still-mini first card, so seeing it expanded meant scrolling down to
  // find it. Pinned rows still win over merely-open ones (a deliberate,
  // persistent choice should outrank a transient one); closing a row drops
  // it back out of this bucket and applyRowOrder() (called from
  // openFully()/collapseToMini() below, alongside its existing pin/sort
  // call sites) puts it back exactly where currentOrder says it belongs -
  // the same restore mechanism pinning already relies on, not a new one.
  function applyRowOrder(){
    const isLandscape = window.matchMedia('(max-width:900px) and (orientation:landscape)').matches;
    const pinned = currentOrder.filter(r => pinnedKeys.has(r.card.dataset.key));
    const openNotPinned = isLandscape
      ? currentOrder.filter(r => !pinnedKeys.has(r.card.dataset.key) && r.card.classList.contains('demo-mini-open'))
      : [];
    const rest = currentOrder.filter(r => !pinnedKeys.has(r.card.dataset.key) && !(isLandscape && r.card.classList.contains('demo-mini-open')));
    let anchor = miniHead;
    [...pinned, ...openNotPinned, ...rest].forEach(({ bar, card }) => {
      anchor.after(bar);
      bar.after(card);
      anchor = card;
    });
  }

  // ---------- Floating controls: open/close all, back to top/bottom ----------
  // Fixed to the viewport (not the page's own scroll position) so they're
  // reachable from anywhere in what can be a very long page once a card
  // with a full phase table is open - the client's own request.
  const fabBar = document.createElement('div');
  fabBar.className = 'demo-fab-bar';
  fabBar.innerHTML = `
    <button type="button" class="demo-fab demo-fab-icon demo-fab-toggle-all" aria-label="פתח הכל">⊞</button>
    <button type="button" class="demo-fab demo-fab-icon demo-fab-top" aria-label="חזרה לראש הדף">↑</button>
    <button type="button" class="demo-fab demo-fab-icon demo-fab-bottom" aria-label="מעבר לתחתית הדף">↓</button>
  `;
  document.body.appendChild(fabBar);
  const toggleAllBtn = fabBar.querySelector('.demo-fab-toggle-all');
  // Client's own explicit "everywhere" ask: a transparent ICON matching
  // the ↑/↓ round buttons beside it, not a text pill - this used to be a
  // "פתח הכל"/"סגור הכל" text button (still transparent-pill-styled only
  // in landscape, solid pill everywhere else); now the exact same icon
  // treatment as its neighbors, at every width. ⊞ (grid/expand) offers
  // "open all", ⊟ (collapse) offers "close all" - aria-label carries the
  // actual action in words for anyone who can't tell from the glyph alone.
  function toggleAllRows(){
    const anyOpen = allRows.some(r => r.card.classList.contains('demo-mini-open'));
    allRows.forEach(r => anyOpen ? r.collapseToMini() : r.openFully());
    toggleAllBtn.textContent = anyOpen ? '⊞' : '⊟';
    toggleAllBtn.setAttribute('aria-label', anyOpen ? 'פתח הכל' : 'סגור הכל');
    toggleAllBtn.title = anyOpen ? 'פתח הכל' : 'סגור הכל';
  }
  toggleAllBtn.addEventListener('click', toggleAllRows);
  // behavior:'smooth' here, unlike the height animation this file no
  // longer does - a native browser scroll (window.scrollTo's own built-in
  // easing) is a completely different, far more battle-tested mechanism
  // than a hand-rolled WAAPI/CSS animation, so the earlier finding that it
  // "doesn't finish" in this specific testing tool (a background/hidden
  // tab throttling its own animation timing, confirmed independently of
  // this feature entirely) isn't a reason to distrust it the way the
  // custom height animation earned distrust - client feedback wanted a
  // roll, not a jump, for these specifically.
  fabBar.querySelector('.demo-fab-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  fabBar.querySelector('.demo-fab-bottom').addEventListener('click', () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));

  // .app is the page's own centered content column (max-width:1460px,
  // margin:0 auto in engine.css) - on any screen wider than that, a plain
  // `right:20px` (fixed to the VIEWPORT's own edge) floats the buttons out
  // in the empty margin outside the cards entirely, disconnected from the
  // content they act on (the client's own report). This keeps them pinned
  // just outside .app's own real right edge instead - in the empty margin,
  // not overlapping the cards - recalculated on resize so it stays correct
  // if the window changes size.
  // Earlier version of this formula ADDED to the gap between .app and the
  // viewport edge, which pushes the buttons FURTHER from the viewport edge
  // than .app's own edge is - i.e. INTO the card content, the opposite of
  // "outside them" (confirmed: at a wide 1800px window with .app capped at
  // 1460px, that version placed the buttons 12px to the LEFT of .app's own
  // right edge, overlapping the cards, instead of in the margin to their
  // right). Subtracting instead moves them toward the viewport edge, i.e.
  // genuinely into that empty margin.
  // Found this round: window.innerWidth INCLUDES the vertical scrollbar's
  // own width (~15-17px, OS/browser-dependent) - but a position:fixed
  // element's own `right` CSS property is anchored to the viewport's
  // padding edge, which EXCLUDES the scrollbar (same box document.
  // documentElement.clientWidth already measures). Every page long enough
  // to need a vertical scrollbar (i.e. basically this page, any time more
  // than a couple of rows are visible) fed that too-large innerWidth into
  // the gutter math, under-anchoring the buttons by exactly the missing
  // scrollbar width - confirmed via getBoundingClientRect(): at a 1500px
  // window the bar's own right edge landed 3px INSIDE .app's own right
  // edge (i.e. overlapping the card column by its full ~90px width),
  // not outside it in the margin. clientWidth matches the same
  // scrollbar-excluded frame getBoundingClientRect() itself already uses,
  // so the two are now consistent.
  const appEl = document.querySelector('.app');
  // Client asked for an additional ~1.5cm (~57px) shift further right (i.e.
  // closer to the viewport's own right edge, deeper into the margin, away
  // from the cards) on top of the existing "just outside .app" placement.
  const EXTRA_RIGHT_SHIFT = 57;
  // Real bug found in THIS round's review: the old formula (gutter-12-
  // EXTRA_RIGHT_SHIFT, floored at 16) only ever compared the bar's own
  // ANCHOR offset (12px gap + 57px shift = 69px total) against .app's edge -
  // it never accounted for the bar's own WIDTH (~83px, mostly the "פתח הכל"
  // pill). Since 69 < 83, the bar's near (right-hand, card-facing) edge
  // landed about 14px PAST .app's own edge - i.e. overlapping the cards by
  // a constant ~14px - on every screen wide enough that the old 16px floor
  // wasn't even active, not just on a narrow one. Confirmed by measurement
  // at 1800px: old formula placed the bar's own left edge at 1608.5 against
  // .app's right edge at 1622.5 - a 14px overlap - even though that width
  // has a generous 162.5px margin to work with. Below, noOverlapRight is
  // the largest `right` value that still keeps the bar's own left edge
  // flush OUTSIDE .app (with a small 8px breathing gap) - the actual
  // constraint that matters, using the bar's own real measured width
  // instead of assuming the anchor offset alone is enough. The client's
  // requested shift (requestedRight) is honored in full wherever it fits
  // within that; only clamped back when it would eat into the cards.
  function positionFabBar(){
    if(!appEl) return;
    const rect = appEl.getBoundingClientRect();
    const gutter = document.documentElement.clientWidth - rect.right;
    const fabWidth = fabBar.getBoundingClientRect().width || fabBar.offsetWidth;
    const gap = 8;
    const noOverlapRight = gutter - fabWidth - gap;
    const requestedRight = gutter - 12 - EXTRA_RIGHT_SHIFT;
    // Below roughly ~1600px, .app's own max-width (1460px) leaves less
    // margin than the bar's own width, so noOverlapRight goes negative -
    // true zero-overlap literally isn't possible there, at ANY right value,
    // since the margin itself (e.g. ~20px at 1500px) is narrower than the
    // ~83px-wide button (confirmed by measurement - this is the real
    // "known tension" the client's two requests create, not something this
    // formula alone can resolve). In that squeeze this sits as close to the
    // viewport's own true edge as still legible (10px) - the smallest
    // overlap the available space allows - rather than the old fixed 16px
    // floor, which sat unnecessarily deeper into the cards. See the
    // session report for the residual overlap this still leaves at ~1500px.
    const floor = 10;
    fabBar.style.right = Math.max(floor, Math.min(requestedRight, noOverlapRight)) + 'px';
  }
  // NOT called yet here - positionFabBar() now measures fabBar's own real
  // rendered width (see above), which only reflects its true ~83px flex-
  // pill layout once the <style> block below has actually been appended to
  // <head>. Calling it this early (before that happens) was a real bug
  // found while verifying this round's fix: fabBar still had only the
  // browser's bare default button styling at this point, so the very
  // first position landed wrong (measured: floored all the way to 10px
  // even at a comfortably wide 1800px window) and only self-corrected on
  // the page's first resize event - i.e. every fresh page load started
  // with the buttons briefly mispositioned, invisible unless the client
  // happened to resize the window. The call is below the style block
  // instead now; the resize listener has no such dependency and is fine
  // to register here.
  window.addEventListener('resize', positionFabBar);

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    /* Every fixed-width column below (both the header's own labels and the
       real bars) shares the same widths and gap, so a value always lands at
       the same x-position row after row - a real aligned table, not just
       several bits of text with gaps between them. The header stays
       visible at all times, including while a card is open, so opening one
       is a single, static-top-edge downward reveal - nothing above it
       moves. */
    /* display itself is controlled procedurally in openFully()/
       collapseToMini() now (see those functions), not by this class - a
       CSS-class-driven display:none would cut the closing animation off on
       its very first frame, since the element would stop rendering the
       instant the class was removed rather than at the end of the shrink.
       This rule still matters as the correct RESTING state before any JS
       has touched a given row at all. */
    /* Tooltip direction: engine.css always opens these upward
       (bottom:135%/122%), which clips/overlaps whatever sits above the
       icon whenever there isn't much room there - the KPI row right under
       the header, in particular. Client's own screenshots showed this on
       desktop too, not just the narrower landscape-mobile header this was
       first fixed for - flipped to open downward everywhere instead. */
    .info-icon:hover::after, .info-icon.tip-open::after{ bottom:auto !important; top:135%; }
    .info-icon:hover::before, .info-icon.tip-open::before{ bottom:auto !important; top:122%; }
    /* Info-sheet z-index fix (see the JS block further down this file that
       toggles this class): raises the CARD holding an open info panel
       above its sibling cards, so the panel no longer renders under/behind
       the next card - client's own screenshots showed this on desktop too
       (a sibling card's own translucent background showing its text
       through the panel underneath it), not just landscape mobile. */
    .demo-info-raised{ position:relative; z-index:20; }
    /* Whenever the whole KPI row only ever has exactly 2 tiles (e.g. Lev
       HaHar's own portfolio) each tile is much wider than the usual 4-per-
       row case everything else here was sized for - engine.css's own
       justify-content:center for the two mini-values inside (בביצוע/
       בתכנון and the like) leaves them clustered in the middle with real
       empty space on both outer edges instead of using that width. Client's
       own explicit ask, for both desktop and mobile: spread them to the
       tile's own edges and size them up - :has() detects "exactly 2 .kpi
       tiles" structurally (2nd child is also the last child) instead of
       needing a client-specific selector, so this keeps working correctly
       if a client's own active/future project counts ever change which
       KPI tiles engine.js renders. em-based sizing (not a fixed px) scales
       relative to whatever base size is already active at a given
       breakpoint (13px mobile landscape, 26px narrow portrait, 38px
       desktop) instead of needing its own copy of every breakpoint. */
    /* space-between (first attempt) pushed the two values all the way to
       the tile's own edges - client's own explicit "went too far, that's
       the extreme, I asked for ~50% more space, not the maximum possible"
       correction. space-around leaves real breathing room at the outer
       edges too (half a gap on each side, not zero) instead of edge-to-
       edge, landing well short of that extreme while still opening up
       real space between the two values compared to the original 8px gap. */
    #kpi-row:has(.kpi:nth-child(2):last-child) .kpi-mini-row-big{ justify-content:space-around !important; }
    #kpi-row:has(.kpi:nth-child(2):last-child) .mini-value-big{ font-size:1.25em !important; }
    #kpi-row:has(.kpi:nth-child(2):last-child) .mini-label{ font-size:1.1em !important; }
    body.demo-compact-active .project-card{ display:none; }
    .demo-mini-bar{ display:none; }
    /* Duration tile's unit text: both spans always exist in the markup
       (see the template) - the short "ח'" form is now the ONLY one ever
       shown, at every width, client's own explicit "everywhere" ask
       (digits first, then "ח'" to their left - e.g. "58 ח'"). This rule
       must NOT live inside any @media(max-width:900px) block - this whole
       compact-card markup renders at every width, including desktop, not
       just mobile. RTL+isolate so the geresh/letter render on the correct
       side of the (LTR-rendered) number instead of picking up the
       surrounding ltr-num container's own direction. The template puts
       this span BEFORE the number now (client's own correction - an
       earlier attempt read right, ended up left because .ltr-num's own
       direction:ltr makes DOM/source order = visual left-to-right order
       regardless of this span's own internal direction:rtl, which only
       affects glyph order WITHIN the span itself) - margin-inline-START,
       not -end: logical properties resolve against THIS element's own
       direction, not the LTR parent's. Since this span itself is
       direction:rtl, ITS "end" side is the physical LEFT - the wrong
       side, since the number that actually needs the gap follows on the
       physical RIGHT. A first attempt used -end and, confirmed by direct
       measurement, produced a real, reproducible ZERO px gap despite
       computing to a non-zero value - not a rounding issue, the wrong
       physical side entirely. */
    .demo-duration-unit-full{ display:none; }
    .demo-duration-unit-short{
      display:inline; direction:rtl; unicode-bidi:isolate; margin-inline-start:3px;
      /* em, not a fixed px - client's own explicit "small" ask, scaled
         relative to whatever size the number itself ends up at in each
         context (the progress tile's own number is bigger than the
         others') instead of one fixed size that would read differently
         small depending on which tile it's in. */
      font-size:0.6em; font-weight:700; vertical-align:baseline;
    }
    body.demo-compact-active .demo-mini-bar{ display:flex; }
    body.demo-compact-active .demo-mini-bar.demo-mini-hidden{ display:none; }
    .demo-mini-head{ display:none; }
    /* padding-bottom cut again (10px -> 5px -> 2px) plus margin-top dropped
       to 0 - client reported the first halving wasn't noticeable at all.
       Root cause found this round: the VISIBLE gap was never actually
       controlled by this padding at all - #projects itself (engine.css,
       shared, not touched here) is display:flex; flex-direction:column;
       gap:8px, and that flex gap inserts its own fixed 8px between
       EVERY pair of visible children regardless of their own padding/
       margin. So the real visible gap was always 8px (from that shared
       rule) plus whatever this padding-bottom added on top - shrinking
       10px->5px->2px only ever shaved a few px off a gap dominated by a
       constant the client could never see change, which is exactly why
       "the first cut wasn't noticeable at all". padding-bottom is now 0 -
       the gap is the shared 8px flex-gap alone, with nothing added on top,
       matching the same 8px used between tiles within a single row (the
       client's own reference point for "a small, deliberate breathing
       gap"). A sticky/scroll-pinned version of this row was also tried and
       explicitly reverted per client feedback (it didn't match what "stays
       above the cards" was actually meant to describe) - this row stays in
       normal document flow, same as every other row. */
    body.demo-compact-active .demo-mini-head{
      display:flex; align-items:center; gap:8px; padding:0 16px 0; margin-top:0;
      color:var(--text-faint); font-size:14.5px; font-weight:700;
    }
    /* padding cut 15px->10px top/bottom (see .demo-mini-tile below too) -
       client reported the rows got visibly taller/"thicker" this round and
       asked for at least 0.75cm (~28px) off. The identity-block redesign
       above (one line instead of three stacked ones) turned out NOT to be
       the actual height driver - measured: with the OLD 3-line identity,
       row height was already dominated by .demo-mini-tile's own fixed 94px
       height + this padding (94+30=124px measured), and the identity
       content itself never exceeded that even before this round's change.
       So the real fix for "thickness" is here and on .demo-mini-tile's own
       height, not the identity restructuring (which was really about the
       OTHER points - one line, wrap behavior, vertical centering). */
    body.demo-compact-active .demo-mini-bar{
      align-items:flex-start; gap:8px; padding:8px 16px; margin-bottom:8px;
      background:var(--surface-2); border:1px solid var(--border); border-radius:10px; cursor:pointer;
      transition:filter .12s ease, box-shadow .12s ease;
    }
    /* filter:brightness (the same technique already used for .demo-fab:hover
       below), not a color-tinted overlay - a color tint mixes a NEW hue
       into the background at a fixed opacity that has to be re-tuned by
       eye for every theme it might render in, and light mode's own accent
       teal is a different color entirely from dark mode's, so one tuned
       opacity value cannot be trusted to give the same result in both
       without checking each one specifically (the client's own report -
       fine in dark, not in light). brightness scales EVERY existing pixel
       (background and text alike) by the same factor instead of mixing in
       an unrelated color, so it cannot introduce a NEW contrast problem
       between the row's own background and its own (already correctly
       contrasted) text in either theme - it can only make the whole thing
       uniformly lighter, never selectively obscure the text. */
    body.demo-compact-active .demo-mini-bar:hover{
      filter:brightness(1.12); box-shadow:0 2px 10px rgba(0,0,0,.18);
    }
    /* Client's own explicit re-ask, both orientations: now sits inline
       right before the project title (moved there in JS - see the comment
       by that move) instead of floating as its own absolutely-positioned
       circle in the card's corner. width/height:1em means "this element's
       own font-size" for a square icon that scales itself automatically -
       every place .demo-mini-title-main's own font-size changes per
       breakpoint below, a matching .demo-compact-chevron font-size line
       keeps this the same size as the title's own letters, per the ask,
       without needing to inherit across sibling elements (not possible in
       plain CSS) or restructure the title's own sizing. margin-inline-end
       is the "one letter's width" gap before the title that follows it in
       DOM (this element comes first = rightmost in RTL, i.e. exactly
       "to the right of the project name" once combined with the DOM move). */
    .demo-compact-chevron{
      display:inline-flex; align-items:center; justify-content:center; width:1em; height:1em;
      border-radius:50%; background:var(--accent); color:var(--surface); font-weight:900;
      font-size:20px; flex:none; margin-inline-end:1ch;
    }
    .demo-mini-col-chevron{ flex:none; }
    /* Dim/outline by default, per the same "i" circle visual language as
       .pc-title-info-icon (border + faint color, no fill) - filled in with
       the accent color only once actually pinned, so its own state is
       clear at a glance without needing a separate label. */
    /* Client's own explicit ask: same diameter as the status pill next to
       it (.activity-pill, "בביצוע"/"בתכנון"/etc). That pill is never
       resized at any breakpoint in either this file or engine.css - a
       constant font-size:11px + padding:2px 9px, measuring 18px tall
       everywhere - so 18px here (replacing the various breakpoint-specific
       sizes below, none of which happened to match it) is correct at
       every width too, not just this one. */
    .demo-mini-pin{
      width:18px; height:18px; flex:none; padding:0; border-radius:50%;
      display:flex; align-items:center; justify-content:center; font-size:11px;
      background:transparent; border:1.5px solid var(--border); cursor:pointer;
      opacity:.55; filter:grayscale(1); transition:opacity .12s ease, filter .12s ease, border-color .12s ease;
    }
    .demo-mini-pin:hover{ opacity:.85; }
    .demo-mini-pin.demo-mini-pin-active{
      opacity:1; filter:none; border-color:var(--accent); background:rgba(var(--accent-rgb),.15);
    }
    .demo-mini-head-pin-spacer{ width:24px; flex:none; }
    /* demo-mini-identity: a top line at [pin]/[status]/[type] (status to
       the pin's LEFT, type to status's left - client's precise spec),
       then the title starting directly below that line (aligned under the
       PIN's own right edge, since chevron sits OUTSIDE this block as its
       own separate column), then dates below the title. No vertical
       centering here (a previous round's choice, now reversed) - status
       and type need to sit "at the pin's height", and the pin has always
       simply been top-aligned via the row's own default align-items -
       flex-start, so this block just stays at the top too, matching it. */
    .demo-mini-identity{ flex:none; width:230px; display:flex; flex-direction:column; gap:2px; min-width:0; }
    .demo-mini-identity-topline{ display:flex; align-items:center; gap:6px; min-width:0; }
    /* Capped at exactly 2 lines with an ellipsis beyond that (client's own
       correction - an earlier round let this wrap indefinitely, which made
       a very long type description push the row taller than wanted).
       -webkit-line-clamp is prefixed but has been supported in every
       mainstream engine (Chromium, Firefox, Safari) for years - there is no
       unprefixed standard equivalent yet in wide enough use to prefer it. */
    .demo-mini-type-text{
      width:113px; flex:none; color:var(--text-faint); font-size:14px; font-weight:700;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      overflow:hidden; text-overflow:ellipsis; line-height:1.25;
    }
    .demo-mini-title-toprow{ display:flex; align-items:center; gap:0; min-width:0; margin-top:2px; }
    /* [data-has-info] already gets position:relative from engine.css's own
       global rule - the info-sheet panel (absolutely positioned, anchored
       to this box) is a child of THIS element, not of the overflow:hidden
       text span next to it, so opening it is never clipped. Since this
       version no longer wraps the bar/card in any overflow:hidden animation
       box, there is nothing else that could clip it either. */
    /* flex:0 1 auto (shrink-to-fit) + max-width:189px (~5cm, the client's
       own wrap threshold), NOT flex:1 1 auto - the earlier version grew
       this box to fill the ENTIRE remaining line regardless of how much
       actual text it held, so the info icon (a flex sibling right after
       it) always sat at the far edge of that oversized box instead of
       right next to the visible text - confirmed via measurement: the
       icon's own x-position was IDENTICAL across every row regardless of
       title length, when it should track the title's own varying width.
       Shrink-to-fit makes the box exactly as wide as its own text (up to
       the 189px cap, beyond which it wraps), so the icon now sits flush
       against wherever the text actually ends. */
    .demo-mini-title-box{ min-width:0; max-width:189px; flex:0 1 auto; }
    /* white-space:normal (not nowrap+ellipsis), wraps past ~189px (~5cm)
       "only if needed" - the client's own spec - since .demo-mini-identity
       itself is a fixed 230px and title-box is flex:1 1 auto within the
       narrower topline-derived width, it naturally gets most of that 230px
       (minus the info icon's own ~20px when present) before wrapping. */
    .demo-mini-title-main{ color:var(--text); font-weight:700; font-size:20px; white-space:normal; line-height:1.2; }
    /* Client's own explicit correction to the earlier "flush against the
       title, no gap" spec: now sized to the title's own letter height
       (width/height:1em - see .demo-compact-chevron's own comment above
       for why em, same reasoning applies here) with a real one-letter gap
       before the title. margin-inline-start (not -end) because this icon
       comes AFTER the title in DOM - in this RTL layout that puts it to
       the title's LEFT, so its own "start" (= right, facing back toward
       the title in RTL) is the side that actually needs the gap. */
    .demo-mini-title-toprow .pc-title-info-icon{
      flex:none; width:1em; height:1em; font-size:20px; margin-inline-start:1ch;
    }
    /* align-self:flex-start (RTL cross-start = right) - the actual fix for
       "dates not aligned to the name". This element also carries the
       shared .ltr-num class (engine.css: direction:ltr; display:inline-
       flex, no justify-content of its own, defaulting to flex-start) - as
       a flex ITEM inside .demo-mini-identity's own column layout, its
       default align-self:stretch made it fill the full 230px column width,
       and THEN its own internal flex-start packing (in a forced-ltr
       context) shoved the actual visible text to the LEFT of that
       stretched box - completely detached from the title's own right edge
       above it, even though text-align:right on this same element (a no-op
       here, since inline-flex positions its own content via justify-
       content, not text-align) looked like it should have fixed it.
       align-self:flex-start stops the stretch, so the box (and the text
       inside it) shrinks to its own natural width and sits at the column's
       right edge - confirmed via measurement to now match the title's own
       right edge exactly, in every row. */
    .demo-mini-title-dates{ color:var(--text-faint); font-size:13.5px; font-weight:600; margin-top:1px; align-self:flex-start; }
    /* Reverted back to single-line ellipsis (client's own correction -
       wrap was tried for this column and explicitly asked to be undone). */
    .demo-mini-col-phase{
      width:160px; flex:none; align-self:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      text-align:right; color:var(--text-faint); font-size:16px; font-weight:700;
    }
    /* Moved back to the row's own end (the true top-left corner of the
       WHOLE row, past every tile) - a precise client correction reversing
       an earlier round's "keep it near the title" placement, which the
       client felt was wrong once seen against the actual tiles ("why is it
       to the right of the completion %?"). flex:none (no fixed width, sizes
       to its own content) + align-items:flex-end mirrors the real card's
       own .pc-top-right (update date above the pace pill, both right-
       aligned within this small block) - no vertical centering, so it sits
       at the row's own top by the row's default align-items:flex-start,
       matching "the most top-left part of the row".
       margin-inline-start:auto is the actual fix for "still not far enough
       left": .demo-mini-bar's own content (chevron+identity+tiles+phase+
       flag) is narrower than the bar itself on most screens, and a plain
       flex row packs every item toward its OWN start edge (the right, in
       this RTL row) by default - leaving the leftover width as empty space
       AFTER the last item instead of pushing that item to the true end.
       margin-inline-start:auto on the LAST item is the standard flex fix:
       it consumes all of that leftover space as its own margin, which
       physically sits on FLAG's right side (its "start" edge in RTL) -
       shoving flag itself all the way to the row's actual left edge,
       regardless of how much unused width the row has. Confirmed this was
       real, not a rounding issue: measured a ~197px gap between flag and
       the bar's own left edge before this fix, at a normal desktop width. */
    .demo-mini-col-flag{ flex:none; margin-inline-start:auto; display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
    .demo-mini-updated{ color:var(--text-faint); font-size:13px; font-weight:600; }
    /* height (not min-height) so every tile is an IDENTICAL box regardless
       of its own content's natural height - the progress tile's own
       content (value + bar + planned% + gap, 4 lines) is naturally taller
       than phases/duration/budget's (value + one sub-line), and min-height
       only sets a floor, not a shared value. */
    /* height cut 94px->84px (see .demo-mini-bar padding above too) - part of
       the same "reduce row thickness by 0.75cm" fix. An earlier attempt at
       78px caused a real regression, caught by the client: the progress
       tile's OWN track (.demo-progress-track below) collapsed to 0 height
       and the bar visibly disappeared. Root cause - .demo-progress-track's
       only children (.demo-progress-fill/.demo-progress-marker) are
       position:absolute, which removes them from normal flow entirely, so
       they don't count toward the track's own automatic min-height; once
       the progress tile's 4 lines of content (value + track + 2 sub-lines)
       no longer comfortably fit in the shrunk tile, flexbox's default
       shrink behavior sacrificed the one child with an automatic min-height
       of zero (the track) down to actually zero, instead of distributing
       the deficit - text lines can't collapse the same way since they have
       real content, so nothing about the OTHER 3 lines looked obviously
       broken, which is why this was easy to miss without a real rendered
       screenshot. Fixed at the actual source (flex-shrink:0 on the track
       itself, below) rather than only via more tile height - that's the
       real, permanent fix; the extra height here is just breathing room. */
    .demo-mini-tile{
      width:100px; height:84px; flex:none; text-align:center; display:flex; flex-direction:column;
      justify-content:center; align-items:center; gap:2px; border:1px dashed rgba(var(--hairline-rgb),.3); border-radius:6px; padding:4px 5px;
    }
    .demo-mini-col-progress{ width:138px; }
    /* Track background is deliberately var(--surface) (NOT --surface-2,
       which is what .demo-mini-bar itself is painted with) - the real
       card's own .progress-track sits on --surface while its .metric tile
       sits on --surface-2, giving the empty track real contrast against its
       surroundings. flex-shrink:0 is the actual fix for the "bar
       disappeared" regression above - without it, this element (with an
       automatic min-height of 0, since its only children are
       position:absolute and don't count toward it) is the first thing
       flexbox collapses under any space pressure in its parent tile,
       instead of ever actually clipping/shrinking the sibling text lines. */
    .demo-progress-track{ position:relative; width:100%; height:6px; flex:none; background:var(--surface); border-radius:3px; margin:3px 0 2px; overflow:visible; }
    .demo-progress-fill{ position:absolute; top:0; right:0; height:100%; border-radius:3px; }
    .demo-progress-marker{ position:absolute; top:-2px; width:2px; height:10px; background:var(--accent); z-index:3; }
    .demo-mini-tile-head{
      width:100px; flex:none; text-align:center; border:1px dashed transparent; border-radius:6px; padding:5px 5px;
    }
    .demo-mini-col-progress.demo-mini-tile-head{ width:138px; }
    .demo-mini-col-budget, .demo-mini-col-spent, .demo-mini-col-remaining{ width:100px; }
    /* var(--number-color), not a fixed accent color - matches the real
       card's own .m-value exactly (engine.css): a plain neutral tone
       regardless of schedule status. Only the progress bar itself and the
       delta/gap line are ever color-coded there, never the main number. */
    .demo-mini-num{ color:var(--number-color); font-weight:800; font-size:21px; }
    .demo-mini-sub{ color:var(--text-faint); font-size:12.5px; font-weight:600; }
    .demo-mini-head .demo-mini-col-status, .demo-mini-head .demo-mini-col-flag, .demo-mini-head .demo-mini-tile-head{ font-family:inherit; }

    /* The row's content width can exceed even a wide desktop viewport once
       every tile (including the budget ones) is present - rather than
       guess at a screen width, the list scrolls horizontally as ONE unit
       past that point (every row's columns stay aligned with the header),
       instead of clipping content or breaking the whole page's own layout.
       On a wide enough screen this is invisible - there's simply nothing
       to scroll.
       Real caveat found in review: setting overflow-x to anything but
       visible makes the browser also compute overflow-y as auto (per the
       CSS overflow spec - visible paired with non-visible on the other
       axis is not a valid combination, and gets silently upgraded), even
       though only the X axis is set here. That turns #projects into a
       vertical clipping box too, which can cut off a mini bar's own
       info-sheet popup (position:absolute, no bounded height itself) if it
       opens on a row near the bottom of the list. There is no way to keep
       overflow-y genuinely visible while overflow-x is auto on the same
       element, so the padding-bottom below is a pragmatic mitigation, not
       a full fix: it pads the container's own bottom edge out far enough
       that a popup opened on the LAST row still has room to render inside
       the now-larger scrollable area instead of being clipped by it. */
    body.demo-compact-active #projects{ overflow-x:auto; padding-bottom:440px; }
    body.demo-compact-active .demo-mini-head{ width:max-content; min-width:100%; }

    /* Floating controls - position:fixed and right is set/kept in sync by
       JS (positionFabBar()) to track .app's own real right edge rather
       than the viewport's, so they always sit right next to the cards
       rather than floating in .app's own outer margin on a wide screen. */
    /* align-items:center (not flex-end) so the narrower round icon buttons
       are horizontally centered under the wider "פתח הכל" pill, not
       pinned to one edge of it - the client's own request. (flex-end also
       resolves against the container's OWN direction, which is RTL here
       via the page's dir="rtl" - worth calling out since it's an easy
       source of "this isn't aligned where I expect" bugs in an RTL
       column-direction flex container; center sidesteps the question
       entirely since it means the same thing regardless of direction.) */
    .demo-fab-bar{
      position:fixed; bottom:20px; z-index:50; display:flex; flex-direction:column; align-items:center; gap:8px;
    }
    /* "פתח הכל" - a soft, mostly-transparent pill (outline + tinted glass
       background, not the earlier solid accent fill) with a distinct pill
       shape (never a circle/diamond) so it still reads as its own,
       different kind of control from the plain round icon buttons below
       it. */
    /* color:var(--shell-text) (not --text) is deliberate here - these
       buttons float directly on the page's own constant-dark outer shell
       background (position:fixed, not inside a card surface), which never
       switches for light mode (see engine.css's own comment on --shell-bg:
       "the outer chrome stays dark navy in both light and dark app
       themes"). --text DOES switch to a dark color for light mode's own
       light card surfaces - using it here meant dark-on-dark, invisible,
       in light mode specifically - client's own screenshot, confirmed
       reproducible by checking engine.css's light-mode variable block
       directly (it redefines --text and --border, not --shell-text). */
    .demo-fab{
      font-family:inherit; font-size:13px; font-weight:700; padding:10px 18px; border-radius:20px;
      border:1.5px solid rgba(var(--accent-rgb),.55); background:rgba(var(--accent-rgb),.14);
      backdrop-filter:blur(6px); color:var(--shell-text); box-shadow:0 4px 14px rgba(0,0,0,.25);
      cursor:pointer; white-space:nowrap; transition:filter .12s ease;
    }
    /* "↑"/"↓" - plain transparent ghost icon buttons: a circle with just a
       border and the arrow glyph, no fill, per the client's own request
       for something more minimal than a solid button here. */
    .demo-fab-icon{
      width:38px; height:38px; padding:0; border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-size:16px; background:rgba(255,255,255,.05); border:1.5px solid var(--shell-text-dim);
    }
    .demo-fab:hover{ filter:brightness(1.15); }

    @media(max-width:560px){
      .demo-fab-bar{ bottom:12px; }
      .demo-fab{ font-size:12px; padding:8px 14px; }
      .demo-fab-icon{ width:34px; height:34px; font-size:14px; }
    }

    /* Wraps engine.js's own #projects-toolbar (search + sort) and
       #projects-filter-bar (status chips) - two separately-inserted
       elements, each already display:flex;flex-wrap:wrap on its own - in
       one shared flex row so they read as a single "sort & filter" control
       cluster (wrapping onto a second line only if the window is too
       narrow for everything at once) instead of two visually disconnected
       bars stacked with a gap between them, per the client's request to
       bring this functionality back in a more standard, unified form. */
    .demo-toolbar-wrap{
      display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px;
      margin-bottom:14px; padding:10px 14px; background:rgba(255,255,255,.03);
      border:1px dashed var(--border); border-radius:10px;
    }
    .demo-toolbar-wrap #projects-toolbar,
    .demo-toolbar-wrap #projects-filter-bar{ margin-bottom:0; }
    .demo-toolbar-label{ color:var(--text-faint); font-size:12.5px; font-weight:700; flex:none; }

    /* ---------- Mobile mini-bar: "Blocks" design ---------- */
    /* Client direction (after two rejected attempts - a stacked flow with
       bare text, then boxed tiles mixed with bare text): every piece of
       information is its own self-contained BLOCK - same box language
       (surface fill, hairline border, rounded corners, small label on top,
       value below) - laid out on one shared grid, so the card reads as an
       ordered dashboard of blocks instead of a flowing list. Same markup as
       desktop (no DOM changes); everything here is inside @media, so desktop
       rules are untouched. Grid is 6 columns so 2-up and 3-up block rows
       coexist on one grid: identity/progress/phase/pace span 6, phases and
       duration span 3 each, budget/spent/remaining span 2 each. */
    @media(max-width:900px){
      body.demo-compact-active #projects{ overflow-x:visible; padding-bottom:24px; }
      body.demo-compact-active .demo-mini-head{ display:none; }
      .demo-toolbar-wrap{ padding:8px 10px; gap:8px 10px; margin-bottom:10px; }

      body.demo-compact-active .demo-mini-bar{
        position:relative; display:none; grid-template-columns:repeat(6,minmax(0,1fr));
        gap:8px; padding:10px; align-items:stretch;
      }
      body.demo-compact-active .demo-mini-bar:not(.demo-mini-hidden){ display:grid; }

      /* Shared block look. */
      .demo-mini-identity, .demo-mini-col-progress, .demo-mini-col-phases, .demo-mini-col-duration,
      .demo-mini-col-budget, .demo-mini-col-spent, .demo-mini-col-remaining,
      .demo-mini-col-phase, .demo-mini-col-flag{
        background:var(--surface); border:1px solid var(--border); border-radius:10px;
        padding:7px 10px; box-sizing:border-box; min-width:0;
      }

      /* Block 1: identity (pin + status + type, title + info, dates). */
      /* padding-inline-end:44px (was) reserved room for the chevron's old
         floating position in this same corner - no longer needed now that
         it sits inline next to the title instead of overlapping anything. */
      .demo-mini-identity{ grid-column:1 / -1; width:auto; gap:5px; }
      .demo-mini-identity-topline{ flex-wrap:wrap; row-gap:4px; }
      .demo-mini-type-text{ width:auto; flex:1 1 0; min-width:0; }
      .demo-mini-title-box{ max-width:100%; }
      .demo-mini-title-main{ font-size:18px; }
      .demo-compact-chevron{ font-size:18px; }
      .demo-mini-title-toprow .pc-title-info-icon{ font-size:18px; }

      /* Blocks with a small label on top and the value below. */
      .demo-mini-tile{ height:auto; min-height:0; width:auto; flex:none; align-items:flex-start; text-align:right; gap:2px; }
      .demo-mini-tile::before{
        order:-1; font-size:12px; font-weight:700; color:var(--text-faint); margin-bottom:2px;
      }
      .demo-mini-col-phases, .demo-mini-col-duration{ grid-column:span 3; }
      .demo-mini-col-phases::before{ content:"שלבים"; }
      .demo-mini-col-duration::before{ content:"משך"; }
      .demo-mini-col-budget, .demo-mini-col-spent, .demo-mini-col-remaining{ grid-column:span 2; padding:7px 8px; }
      .demo-mini-col-budget::before{ content:"תקציב"; }
      .demo-mini-col-spent::before{ content:"נוצל"; }
      .demo-mini-col-remaining::before{ content:"יתרה"; }
      .demo-mini-num{ font-size:18px; line-height:1.2; }
      .demo-mini-col-budget .demo-mini-num, .demo-mini-col-spent .demo-mini-num, .demo-mini-col-remaining .demo-mini-num{ font-size:16px; }

      /* Progress block: full width, big value, track spanning the block. */
      .demo-mini-col-progress{ grid-column:1 / -1; display:grid; grid-template-columns:1fr auto; column-gap:8px; align-items:baseline; }
      .demo-mini-col-progress::before{ content:"התקדמות"; grid-column:1 / -1; }
      .demo-mini-col-progress .demo-mini-num{ font-size:24px; grid-column:1 / -1; justify-self:start; }
      .demo-mini-col-progress .demo-progress-track{ background:rgba(0,0,0,.28); }
      .demo-mini-col-progress .demo-progress-track{ grid-column:1 / -1; margin:4px 0 3px; }
      .demo-mini-col-progress .demo-mini-sub:last-child{ text-align:left; }

      /* Current phase block: label on top, value wraps if long. */
      .demo-mini-col-phase{
        grid-column:1 / -1; align-self:auto; width:auto; white-space:normal; font-size:15px; line-height:1.3;
      }
      .demo-mini-col-phase::before{
        content:"שלב נוכחי"; display:block; font-size:12px; font-weight:700; color:var(--text-faint); margin-bottom:2px;
      }

      /* Pace block: update date on one side, pill on the other. */
      .demo-mini-col-flag{
        grid-column:1 / -1; margin-inline-start:0; flex-direction:row; align-items:center;
        justify-content:space-between; gap:8px;
      }

      /* Floating controls: all three are now the same plain round icon
         button (.demo-fab-icon) - open/close-all included, client's own
         "everywhere" ask - so this only needs to size them, not hide or
         re-show anything. */
      .demo-fab-icon{ width:40px; height:40px; font-size:16px; }
    }
    /* Scroll/toggle-all icons: 25% smaller in landscape specifically -
       overrides the shared 40px size right above (portrait keeps that
       size unchanged). */
    @media(max-width:900px) and (orientation:landscape){
      .demo-fab-icon{ width:30px !important; height:30px !important; font-size:13px !important; }
      /* Floating controls: moved to the bottom-LEFT here specifically -
         client's own explicit report that they sit on the right (where
         positionFabBar()'s desktop/portrait margin-following JS also
         anchors them in landscape, since nothing here overrode that
         before) and get in the way of the real content, which reads on
         the right in this RTL layout. !important beats that JS's own
         plain (non-important) inline right value, the same override
         technique already used elsewhere in this file for exactly that
         reason. */
      .demo-fab-bar{ left:12px !important; right:auto !important; }
    }

    @media(max-width:560px) and (orientation:portrait){
      body.demo-compact-active .demo-mini-bar{ padding:8px; gap:6px; }
      .demo-mini-title-main{ font-size:17px; }
      .demo-compact-chevron{ font-size:17px; }
    }

    /* Portrait phones: every project card is full width - same Blocks
       language, compacted (tile sub-lines and the "planned" line dropped,
       single-line phase) so it stays compact; the dropped detail is in the
       opened full card. Used to be a fixed 227px (~10cm) height too, but
       unlike landscape's own multi-column grid (where a fixed height made
       every card in the same ROW match its tallest neighbor), portrait's
       cards are single-column - nothing else ever sat beside one to
       justify matching its height to, so a fixed value here only ever
       left dead space at the bottom of any card whose real content needed
       less than 227px - client's own screenshot, confirmed. height:auto
       lets each one size to its own real content instead, same fix
       landscape already got for the equivalent problem there. */
    @media(max-width:900px) and (orientation:portrait){
      body.demo-compact-active .demo-mini-bar:not(.demo-mini-hidden) {
        height:auto; box-sizing:border-box; padding:3px 4px; gap:3px; grid-auto-rows:min-content; align-content:start;
      }
      .demo-mini-identity, .demo-mini-col-progress, .demo-mini-col-phases, .demo-mini-col-duration, .demo-mini-col-budget, .demo-mini-col-spent, .demo-mini-col-remaining, .demo-mini-col-phase, .demo-mini-col-flag {
        padding:3px 8px;
      }
      .demo-mini-identity { gap:2px; }
      .demo-mini-identity-topline { gap:5px; }
      .demo-mini-type-text { flex:1 1 0; min-width:0; order:0; -webkit-line-clamp:1; font-size:12.5px; }
      .demo-mini-title-main { font-size:16px; line-height:1.15; }
      .demo-mini-title-dates { font-size:12.5px; }
      .demo-mini-title-toprow .pc-title-info-icon { font-size:16px; }
      .demo-compact-chevron{ font-size:16px; }
      .demo-mini-col-progress { grid-template-columns:auto 1fr; column-gap:8px; align-items:center; }
      .demo-mini-col-progress::before { grid-column:1; }
      .demo-mini-col-progress .demo-mini-num { font-size:22px; grid-column:2; justify-self:start; }
      .demo-mini-col-progress .demo-progress-track { margin:3px 0 2px; }
      .demo-mini-col-progress .demo-mini-sub:not(:last-child) { display:none; }
      .demo-mini-col-progress .demo-mini-sub:last-child { grid-column:3; grid-row:1; text-align:left; font-size:11px; }
      .demo-mini-col-progress { grid-template-columns:auto auto 1fr; }
      .demo-mini-col-progress .demo-progress-track { grid-column:1 / -1; }
      .demo-mini-tile:not(.demo-mini-col-progress) .demo-mini-sub { display:none; }
      .demo-mini-col-phases, .demo-mini-col-duration { display:none; }
      .demo-mini-col-budget, .demo-mini-col-spent, .demo-mini-col-remaining { flex-direction:row; align-items:baseline; justify-content:space-between; gap:3px; padding:3px 6px; }
      .demo-mini-col-budget::before, .demo-mini-col-spent::before, .demo-mini-col-remaining::before { order:0; margin-bottom:0; font-size:10.5px; }
      .demo-mini-col-flag .flag { font-size:11px; padding:2px 10px; }
      .demo-mini-num { font-size:16px; }
      .demo-mini-col-budget .demo-mini-num, .demo-mini-col-spent .demo-mini-num, .demo-mini-col-remaining .demo-mini-num { font-size:14px; }
      .demo-mini-col-phase { font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .demo-mini-col-phase::before { display:inline; margin:0 0 0 6px; font-size:11px; }
      .demo-mini-col-flag { padding:3px 8px; }
      .demo-mini-tile::before { font-size:11px; }
      .demo-mini-col-budget .demo-mini-num, .demo-mini-col-spent .demo-mini-num, .demo-mini-col-remaining .demo-mini-num { font-size:12.5px; }
    }

    /* Landscape phones: every project card is a fixed 5cm (~189 css px)
       tall, full width, on a 12-column grid: identity | progress | pace on
       top, five metric blocks below, current phase last. */
    @media(max-width:900px) and (orientation:landscape){
      body.demo-compact-active:not(.demo-classic) .demo-mini-bar:not(.demo-mini-hidden) {
        display:grid; height:113px; box-sizing:border-box; padding:2px 8px; gap:2px 5px;
        grid-template-columns:repeat(12,minmax(0,1fr)); grid-auto-rows:min-content; align-content:start;
      }
      body:not(.demo-classic) .demo-mini-identity, body:not(.demo-classic) .demo-mini-col-progress, body:not(.demo-classic) .demo-mini-col-phases, body:not(.demo-classic) .demo-mini-col-duration, body:not(.demo-classic) .demo-mini-col-budget, body:not(.demo-classic) .demo-mini-col-spent, body:not(.demo-classic) .demo-mini-col-remaining, body:not(.demo-classic) .demo-mini-col-phase, body:not(.demo-classic) .demo-mini-col-flag {
        padding:2px 8px; border-radius:8px;
      }
      body:not(.demo-classic) .demo-mini-identity { grid-column:span 5; order:0; display:flex; flex-flow:row wrap; align-items:baseline; gap:1px 8px; padding-inline-end:8px; }
      body:not(.demo-classic) .demo-mini-identity-topline { flex:1 1 100%; }
      body:not(.demo-classic) .demo-mini-identity-topline { gap:5px; }
      body:not(.demo-classic) .demo-mini-type-text { flex:1 1 0; min-width:0; order:0; -webkit-line-clamp:1; font-size:11.5px; }
      body:not(.demo-classic) .demo-mini-title-main { font-size:15px; line-height:1.15; }
      body:not(.demo-classic) .demo-mini-title-dates { font-size:11px; }
      body:not(.demo-classic) .demo-mini-title-toprow .pc-title-info-icon { font-size:15px; }
      body:not(.demo-classic) .demo-compact-chevron{ font-size:15px; }
      body:not(.demo-classic) .demo-mini-col-progress { grid-column:span 4; order:1; }
      body:not(.demo-classic) .demo-mini-col-progress { grid-template-columns:auto auto 1fr; column-gap:8px; align-items:center; }
      body:not(.demo-classic) .demo-mini-col-progress::before { grid-column:1; }
      body:not(.demo-classic) .demo-mini-col-progress .demo-mini-num { font-size:18px; grid-column:2; justify-self:start; }
      body:not(.demo-classic) .demo-mini-col-progress .demo-progress-track { margin:2px 0 1px; grid-column:1 / -1; }
      body:not(.demo-classic) .demo-mini-col-progress .demo-mini-sub:not(:last-child) { display:none; }
      body:not(.demo-classic) .demo-mini-col-progress .demo-mini-sub:last-child { grid-column:3; grid-row:1; text-align:left; font-size:10.5px; }
      body:not(.demo-classic) .demo-mini-col-flag .flag { font-size:10.5px; padding:1px 9px; }
      body:not(.demo-classic) .demo-mini-col-flag { grid-column:span 3; order:2; flex-direction:column; align-items:flex-start; justify-content:center; gap:3px; padding-inline-end:38px; }
      body:not(.demo-classic) .demo-mini-updated { font-size:10.5px; }
      body:not(.demo-classic) .demo-mini-tile:not(.demo-mini-col-progress) .demo-mini-sub { display:none; }
      body:not(.demo-classic) .demo-mini-col-phases, body:not(.demo-classic) .demo-mini-col-duration, body:not(.demo-classic) .demo-mini-col-remaining { grid-column:span 2; padding:1px 7px; }
      body:not(.demo-classic) .demo-mini-col-budget, body:not(.demo-classic) .demo-mini-col-spent { grid-column:span 3; padding:1px 7px; }
      body:not(.demo-classic) .demo-mini-col-phases { order:3; } .demo-mini-col-duration{ order:4; } .demo-mini-col-budget{ order:5; }
      body:not(.demo-classic) .demo-mini-col-spent { order:6; } .demo-mini-col-remaining{ order:7; }
      body:not(.demo-classic) .demo-mini-tile::before { font-size:10.5px; margin-bottom:0; }
      body:not(.demo-classic) .demo-mini-col-phases, body:not(.demo-classic) .demo-mini-col-duration, body:not(.demo-classic) .demo-mini-col-budget, body:not(.demo-classic) .demo-mini-col-spent, body:not(.demo-classic) .demo-mini-col-remaining { flex-direction:row; align-items:baseline; justify-content:space-between; gap:4px; }
      body:not(.demo-classic) .demo-mini-col-phases::before, body:not(.demo-classic) .demo-mini-col-duration::before, body:not(.demo-classic) .demo-mini-col-budget::before, body:not(.demo-classic) .demo-mini-col-spent::before, body:not(.demo-classic) .demo-mini-col-remaining::before { order:0; }
      body:not(.demo-classic) .demo-mini-num, body:not(.demo-classic) .demo-mini-col-budget .demo-mini-num, body:not(.demo-classic) .demo-mini-col-spent .demo-mini-num, body:not(.demo-classic) .demo-mini-col-remaining .demo-mini-num { font-size:13.5px; }
      body:not(.demo-classic) .demo-mini-col-phase { grid-column:1 / -1; order:8; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      body:not(.demo-classic) .demo-mini-col-phase::before { display:inline; margin:0 0 0 6px; font-size:10.5px; }
    }
    /* Landscape phones: cards fill the row EXACTLY via CSS Grid on the
       #projects container itself - 3 equal-width columns by default, 4 on
       a wide-enough phone (>=760px) - client's own explicit spec ("minimum
       3, grow to fill the phone's actual width exactly, 4 only if the
       phone is very large"). This replaces an earlier flex-wrap version
       with a FIXED card width (189px) - the real bug there: 189px never
       divides evenly into an arbitrary phone width, so flex-wrap always
       left a leftover margin's worth of empty space at the row's end
       instead of the cards actually filling it. Grid's repeat(N,1fr)
       divides the exact available width N ways with zero remainder. */
    @media(max-width:900px) and (orientation:landscape){
      /* align-items:start (was) let every card size itself to its own
         content and sit flush at the row's own top - a card with a longer
         title/more tiles reads visibly taller than its neighbors. A single
         GLOBAL fixed height (this file's own first attempt at "every card
         the same width AND height") fixed the mismatch but at the cost of
         real, visible empty space at the bottom of every shorter card -
         client's own screenshots, several rows deep of dead space - since
         it had to be tall enough for the SINGLE tallest card anywhere in
         the whole list, not just its own row. Removing this override
         (stretch is Grid's own default for align-items) instead makes
         every card fill its own ROW's height - uniform WITHIN each row,
         where cards actually sit side by side and get compared, without
         forcing that same height onto every other row too. */
      body.demo-compact-active.demo-classic #projects {
        display:grid; grid-template-columns:repeat(3,1fr); gap:8px;
      }
      body.demo-compact-active.demo-classic .project-card.demo-mini-open { grid-column:1 / -1; }
      body.demo-compact-active.demo-classic .demo-mini-bar:not(.demo-mini-hidden) {
        display:grid; width:auto; box-sizing:border-box; margin-bottom:0;
        grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; padding:5px; grid-auto-rows:min-content;
      }
    }
    @media(min-width:760px) and (max-width:900px) and (orientation:landscape){
      body.demo-compact-active.demo-classic #projects { grid-template-columns:repeat(4,1fr); }
    }
    @media(max-width:900px) and (orientation:landscape){
      body.demo-classic .demo-mini-identity, body.demo-classic .demo-mini-col-progress, body.demo-classic .demo-mini-col-phases, body.demo-classic .demo-mini-col-duration, body.demo-classic .demo-mini-col-budget, body.demo-classic .demo-mini-col-spent, body.demo-classic .demo-mini-col-remaining, body.demo-classic .demo-mini-col-phase, body.demo-classic .demo-mini-col-flag {
        padding:3px 7px; border-radius:8px;
      }
      body.demo-classic .demo-mini-identity { grid-column:1 / -1; order:0; gap:3px; }
      body.demo-classic .demo-mini-title-toprow .pc-title-info-icon { font-size:15px; }
      body.demo-classic .demo-mini-identity-topline { gap:4px; }
      body.demo-classic .demo-mini-type-text { font-size:11.5px; -webkit-line-clamp:1; flex:1 1 100%; order:5; }
      body.demo-classic .demo-mini-title-main { font-size:15px; }
      body.demo-classic .demo-compact-chevron{ font-size:15px; }
      body.demo-classic .demo-mini-title-dates { font-size:11.5px; }
      body.demo-classic .demo-mini-col-progress { grid-column:1 / -1; order:1; }
      body.demo-classic .demo-mini-col-progress .demo-mini-num { font-size:18px; }
      body.demo-classic .demo-mini-col-progress .demo-progress-track { margin:2px 0 1px; }
      body.demo-classic .demo-mini-col-progress .demo-mini-sub { font-size:10.5px; }
      body.demo-classic .demo-mini-col-progress .demo-mini-sub:not(:last-child) { display:none; }
      body.demo-classic .demo-mini-col-progress .demo-mini-sub:last-child { grid-column:1 / -1; text-align:right; }
      body.demo-classic .demo-mini-col-phases, body.demo-classic .demo-mini-col-duration { grid-column:span 1; order:2; }
      body.demo-classic .demo-mini-col-budget, body.demo-classic .demo-mini-col-spent, body.demo-classic .demo-mini-col-remaining { grid-column:span 1; padding:4px 6px; }
      body.demo-classic .demo-mini-col-budget { grid-column:1 / -1; order:3; }
      body.demo-classic .demo-mini-col-spent, body.demo-classic .demo-mini-col-remaining { order:4; }
      body.demo-classic .demo-mini-tile::before { font-size:10.5px; margin-bottom:0; }
      body.demo-classic .demo-mini-num, body.demo-classic .demo-mini-col-budget .demo-mini-num, body.demo-classic .demo-mini-col-spent .demo-mini-num, body.demo-classic .demo-mini-col-remaining .demo-mini-num { font-size:14px; }
      body.demo-classic .demo-mini-tile:not(.demo-mini-col-progress) .demo-mini-sub { display:none; }
      body.demo-classic .demo-mini-col-phases, body.demo-classic .demo-mini-col-duration, body.demo-classic .demo-mini-col-budget, body.demo-classic .demo-mini-col-spent, body.demo-classic .demo-mini-col-remaining { flex-direction:row; align-items:baseline; justify-content:space-between; gap:4px; }
      body.demo-classic .demo-mini-col-phases::before, body.demo-classic .demo-mini-col-duration::before, body.demo-classic .demo-mini-col-budget::before, body.demo-classic .demo-mini-col-spent::before, body.demo-classic .demo-mini-col-remaining::before { order:0; }
      body.demo-classic .demo-mini-col-spent .demo-mini-num, body.demo-classic .demo-mini-col-remaining .demo-mini-num { font-size:12px; }
      body.demo-classic .demo-mini-col-phase { grid-column:1 / -1; order:5; font-size:12px; }
      body.demo-classic .demo-mini-col-phase::before { font-size:10.5px; margin-bottom:0; }
      body.demo-classic .demo-mini-col-flag { grid-column:1 / -1; order:6; flex-direction:row; align-items:center; justify-content:space-between; gap:4px; }
      body.demo-classic .demo-mini-updated { font-size:10.5px; }
      body.demo-classic .demo-mini-col-flag .flag, body.demo-classic .demo-mini-col-flag .status-pill { font-size:11px; padding:2px 8px; }
    }

    /* View-mode toggle + the row that hosts it: landscape phones only -
       display:contents on every other size/orientation means this wrapper
       adds no box of its own, so #projects-filter-bar sits exactly where
       it always did (inside .demo-toolbar-wrap) everywhere else. */
    .demo-filter-row{ display:contents; }
    .demo-mode-toggle{ display:none; }
    @media(max-width:900px) and (orientation:landscape){
      .demo-filter-row{
        display:flex; align-items:center; gap:8px; width:100%;
      }
      .demo-filter-row #projects-filter-bar{ flex:1 1 auto; min-width:0; margin-bottom:0; }
      /* Search box: stretch all the way to the screen's own left edge -
         client's explicit request. engine.css already makes #project-search
         itself flex:1 1 auto in landscape, but its PARENT (#projects-
         toolbar) was never told to grow - a flex-grow child inside a
         content-sized parent has no spare room to actually expand into.
         label+toolbar share one line (toolbar now grows to fill it, search
         grows within that); .demo-filter-row keeps flex:1 1 100% so it
         still always starts its OWN line below, same as before. */
      .demo-toolbar-wrap #projects-toolbar{ flex:1 1 auto; min-width:0; margin-bottom:0; }
      .demo-toolbar-label{ flex:none; }
      .demo-filter-row{ flex:1 1 100%; }
      .demo-mode-toggle{
        display:inline-flex; align-items:stretch; flex:none; border-radius:8px; overflow:hidden;
        border:1.5px solid var(--border); background:var(--surface);
      }
      .demo-mode-btn{
        display:flex; align-items:center; justify-content:center; width:30px; height:28px;
        background:transparent; border:none; color:var(--text-faint); cursor:pointer; font-size:14px; line-height:1;
      }
      .demo-mode-btn:not(:last-child){ border-inline-end:1.5px solid var(--border); }
      .demo-mode-btn.active{ background:rgba(var(--accent-rgb),.18); color:var(--accent); }
      /* Filter chips: must read as one line with NO scrolling at all -
         client's own explicit, repeated request. overflow-x is hidden (not
         engine.css's own auto) so if fitFilterChipsToWidth below ever still
         can't make everything fit, the failure is a clipped last chip
         (visible, fixable) rather than a scrollbar/scrollable row, which
         the client explicitly does not want under any circumstance. */
      #projects-filter-bar{ flex-wrap:nowrap !important; overflow-x:hidden; }
      /* Shrunk further than engine.css's own already-compact 900px sizing
         (padding:6px 11px, font 11.5px) - at a narrower landscape phone
         (~650-700px) that still didn't leave room for every chip on one
         line without scrolling, which the client explicitly rejected
         ("can't have a filter icon missing on the left"/scrolled out of
         view) - this fits all 7 default chips with room to spare down to
         ~650px wide. */
      /* Sized via JS (fitFilterChipsToWidth below), not a fixed value here -
         the client's own correction: a single hardcoded small size either
         wastes space on a wide phone or still overflows on a narrow one.
         The custom properties default to the LARGEST tier; JS only steps
         them down if this phone's width actually needs it. */
      .filter-btn{
        flex:none; white-space:nowrap;
        padding:var(--fc-pad-v, 6px) var(--fc-pad-h, 12px) !important;
        font-size:var(--fc-font, 12px) !important;
      }
      #projects-filter-bar{ gap:var(--fc-gap, 6px) !important; }
      /* The chevron used to be entirely removed in landscape (the whole
         card/row is already its own click target regardless, so it was
         purely decorative) - client's own later, explicit re-ask brought
         it back inline next to the title instead (see the JS move and the
         .demo-compact-chevron rules above for the how/why). */
      body.demo-classic .demo-mini-identity{ padding-inline-end:8px; }
      body:not(.demo-classic) .demo-mini-identity{ padding-inline-end:8px; }
      /* Every per-project tile is forced to the exact same box - client's
         own explicit request ("all the same size, height, width") - and
         long text always ellipsizes instead of wrapping/growing the tile.
         :not(.demo-mini-col-progress) is the actual fix for a real bug the
         client reported ("the percentage sits BELOW the bar, the bar rides
         over it"): progress is also a .demo-mini-tile, so this rule's own
         height:34px used to apply to it too - but progress stacks 4 pieces
         (label / value / track / sub-line) that need far more than 34px,
         so its content overflowed and visually collided instead of
         stacking cleanly. Progress keeps its own full-width, auto-height
         layout (below) - only the small single-line tiles get the fixed
         34px box. */
      /* height 34px->46px + align-items:center (was flex-start, inherited
         from an older non-grid design that no longer applies here) +
         padding reset to a single consistent 4px - the actual fix for two
         things the client reported together: content "sitting a bit too
         high" (real cause: at the old 34px + the shared rule's own 7px/
         5px vertical padding, label+gap+value needed MORE height than the
         box actually had - true centering is meaningless once content
         already overflows its own box) AND "numbers should be ~1.5x
         bigger" (below) - which needs the extra height to actually fit. */
      body.demo-classic .demo-mini-tile:not(.demo-mini-col-progress){
        width:100%; height:46px; box-sizing:border-box; justify-content:center;
        align-items:center; padding:4px 6px !important;
      }
      body.demo-classic .demo-mini-tile:not(.demo-mini-col-progress) .demo-mini-num,
      body.demo-classic .demo-mini-tile:not(.demo-mini-col-progress) .demo-mini-sub{
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;
      }
      /* Numbers/percentages ~1.5x bigger - client's own explicit "there's
         room, at least 1.5x" ask (measured 14px before -> 21px). */
      body.demo-classic .demo-mini-tile:not(.demo-mini-col-progress) .demo-mini-num{
        font-size:21px !important;
      }
      /* Progress tile's own compact stacking - label+value on one line,
         track right below, gap line dropped (redundant with the label
         above it) - this is what actually removes the ~1cm of empty space
         the client reported in each card (progress was previously taller
         than it needed to be, inflating the whole card/grid's height). */
      body.demo-classic .demo-mini-col-progress{
        height:auto; display:grid; grid-template-columns:auto auto 1fr; column-gap:6px; align-items:baseline;
      }
      body.demo-classic .demo-mini-col-progress::before{ grid-column:1; }
      body.demo-classic .demo-mini-col-progress .demo-mini-num{ grid-column:2; justify-self:start; font-size:24px; }
      body.demo-classic .demo-mini-col-progress .demo-progress-track{ grid-column:1 / -1; margin:2px 0 1px; }
      body.demo-classic .demo-mini-col-progress .demo-mini-sub:not(:last-child){ display:none; }
      body.demo-classic .demo-mini-col-progress .demo-mini-sub:last-child{ grid-column:3; grid-row:1; text-align:left; font-size:10px; }
      body.demo-classic .demo-mini-col-phase{
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      body.demo-classic .demo-mini-type-text{
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; -webkit-line-clamp:1;
      }

      /* ---------- Top KPI row + weighted-progress header: same Blocks
         language, aggressively smaller than the default engine.css mobile
         sizing (client's explicit "way too much whitespace, shrink it a
         lot, aim for 4 per row" + "shrink the weighted-completion KPI's
         own internal gaps specifically") - CSS-only, engine.js/engine.css
         untouched. */
      /* Client's own follow-up: a fixed repeat(4,1fr) left empty gap
         whenever there weren't exactly a multiple of 4 tiles (2 KPIs, or
         6). flex (not grid) always divides the row's full width evenly
         across however many .kpi tiles actually exist - 2, 4, 6, whatever
         - with no fixed column count to get out of sync with the real
         count. */
      #kpi-row{ display:flex !important; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
      #kpi-row .kpi{ flex:1 1 0; }
      .kpi{ border-width:1.5px; padding:5px 4px 4px !important; min-width:0; }
      .kpi .label-row{ margin-bottom:2px !important; }
      .kpi .label{ font-size:11px !important; }
      /* Client's own explicit "a bit small" ask on these specifically -
         nudged up from 20px, still well within the 4-per-row tile. */
      .kpi .value{ font-size:23px !important; }
      .kpi-mini-row-big{ gap:8px !important; margin-top:0 !important; }
      .kpi-mini-row-big .mini .mini-label{ font-size:9px !important; white-space:nowrap; }
      .kpi-mini-row-big .mini-value-big{ font-size:13px !important; }
      /* "אחוזי השלמת ביצוע משוקללים" (this box's own title text) - client's
         explicit "shrink this whole cube to 3cm (~113px) tall" ask. Its
         collapsed height alone already measured under that, but the box's
         OWN outer margin plus the "פירוט שלבים"/chevron sub-line pushed its
         real on-screen footprint past 3cm - min-height + tighter margins
         cap the true total. */
      #agg-row{
        background:var(--surface); border:1px solid var(--border); border-radius:8px;
        padding:6px 8px !important; margin-bottom:4px; min-height:0;
      }
      #agg-row .pc-top-row{ margin:0 !important; }
      /* Chevron + "% השלמת ביצוע משוקללים" row: engine.css's own
         margin-top:14px on .agg-title (meant for the roomier default
         layout) reads as noticeably too far below the info-icon/flag row
         above it once everything else here has been shrunk this much -
         client's own explicit "~5mm higher" ask. -5px nets a 19px (~5mm)
         upward shift from that 14px baseline. */
      /* -5px (last round's "~5mm higher" fix) turned out to pull the
         chevron up close enough to touch the info-icon row directly above
         it - client's own follow-up report, confirmed by measurement (a
         ~0.5px gap, effectively touching). -2px keeps most of that upward
         shift while leaving a few px of real clearance. */
      #agg-row .agg-title{ margin-inline-start:0 !important; margin-top:-2px !important; }
      #agg-row .agg-title-text{ font-size:12px; }
      #agg-row .flag{ font-size:10px; padding:1px 7px; }
      /* Every "i" info icon shrunk 50% - client's own explicit "everywhere"
         ask, not just the per-project title icon above (that one's handled
         separately per view-mode). Covers the KPI tiles' own icons and the
         one on this "אחוזי השלמת ביצוע משוקללים" header. */
      .info-icon{ width:13px !important; height:13px !important; font-size:7px !important; }
      .kpi > .info-icon{ top:4px !important; right:5px !important; }
      /* Weighted-completion widget's own expand/collapse chevron ("›") -
         shrunk 50% same as the info icon beside it, client's own explicit
         ask. Scoped to .agg-title specifically (not .pc-chevron generally)
         since that class is ALSO the real per-project chevron elsewhere -
         this demo already hides that one in landscape via its own
         .demo-compact-chevron, so this rule only ever matches the one
         instance that's actually still visible: the agg/weighted row's. */
      #agg-row .agg-title .pc-chevron{ width:13px !important; height:13px !important; font-size:7.5px !important; }
      /* Project-status summary line ("5 פרויקטים פעילים...") - client's
         own explicit "must always be exactly one line, whatever the phone
         size" ask. engine.css already ellipsizes this by default, but only
         reliably down to its own tested widths - reinforced here so it
         can never wrap even on an unusually narrow landscape phone. */
      #kpi-plain-summary{ overflow:hidden; }
      #kpi-plain-summary .kpi-plain-summary-text{
        white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important;
        display:block; max-width:100%; font-size:12px;
      }
      /* The weighted-completion bar's own internal spacing specifically -
         client's explicit "shrink the gaps inside this one" ask. Margin
         bumped back up from the original 2px (client's own follow-up
         suggestion, after the -4px label fix below still left it just
         barely clipping the bar's own top edge - see that rule's own
         comment for the exact math) specifically to make room for the
         planned-% label floating above the bar without also needing to
         re-touch the title/chevron spacing above it again. */
      #agg-bar{ margin:10px 0 0 !important; }
      #agg-bar .tl-row{ margin-bottom:0 !important; }
      /* engine.css's own top:-22px (relative to the marker, itself already
         raised via .agg-row .agg-planned-marker{top:-8px}) floated this
         label all the way up into the title/chevron row above it -
         confirmed by measurement (full overlap, not just close) - client's
         own report that opening the widget rides the % text up over the
         icon and the title text. The first attempt (-4px) cleared the
         title but - confirmed by a client screenshot AND by re-measuring -
         its own bottom edge still dipped 2px into the bar/track below it.
         -6px combined with the extra #agg-bar margin-top above clears
         both: title-side gap grows to a comfortable 9px, and the label's
         own bottom now lands exactly flush with the track's top edge. */
      #agg-bar .agg-planned-label{ font-size:10px; top:-6px !important; }
      #agg-bar .tl-track{ height:20px !important; }

      /* Site header (logo + "PORTFOLIO CONTROL ROOM" + "מרכז בקרת
         פרויקטים..."): shrunk by half - client's own explicit "-50%" ask.
         engine.js/engine.css's own scroll-triggered shrink is a SEPARATE,
         narrower effect (a few px off font-size); this is a flat, always-on
         landscape-mobile reduction regardless of scroll position. */
      /* body's own top padding (engine.css: padding:26px 20px 36px, always
         on, not header-height-aware) sits BEFORE .app's own margin-top in
         the box model - zeroed here so the JS below (which pins .app's
         margin-top to header_height+19px) controls the ENTIRE visible gap
         by itself, instead of this adding its own fixed 26px on top of
         that regardless of what the JS computes. */
      body{ padding-top:0 !important; }
      header{ padding:8px 10px !important; }
      header img{ height:24px !important; }
      .eyebrow{ font-size:9px !important; margin-bottom:2px !important; }
      h1{ font-size:15px !important; }
      .header-meta{ font-size:11px !important; }

      /* "אחוזי השלמת ביצוע משוקללים" opened/expanded - the whole title +
         pill + info-icon + bar + track + year-labels widget, ~50% smaller
         than before, per the client's own screenshot pointing at exactly
         this (the collapsed header was already compact; this is what was
         still full-size). Height only (not a fixed width - it already
         matches its container, same as everything else here). */
      #tl-bars-clip{ font-size:11px; }
      /* .agg-row .tl-row (engine.css) is a hardcoded 30px regardless of how
         thin the track inside it is - the track's own height alone doesn't
         shrink the row around it, found by measuring: track was already
         14px but the row stayed 30px. */
      #agg-bar .tl-row{ height:16px !important; margin-bottom:0 !important; }
      #agg-bar .tl-track{ height:14px !important; }
      /* This corner year label (on the always-visible summary bar
         specifically - NOT the year AXIS row inside the expanded
         individual-rows section below, which is untouched and still shows
         the full year range) turned out impossible to position robustly:
         first it overlapped the chevron above it (an earlier fix moved it
         up), then - client's own follow-up screenshot - it started
         colliding with the planned-% label floating just beside it
         instead, since both sit in the same small area and the planned
         marker's own horizontal position shifts with the real data (a low
         weighted-planned% pushes its marker, and this label, right up
         against this same corner). Hidden here instead of chasing another
         position that only works for some data values - the expanded
         axis row already shows this same start/end year information
         without the collision risk. */
      #agg-bar .agg-year-endpoint{ display:none; }
      #agg-bar .agg-planned-marker{ height:14px !important; }
      /* .timeline-axis/.today-line are only visibility:hidden (not
         display:none) while collapsed - engine.css keeps them, so they
         still reserve their own ~32px of layout space even though nothing
         is visibly there. Zeroing that out (collapsed state only, via the
         same :not(.expanded) engine.css itself already uses to hide them)
         plus trimming .tl-inner's own 28px margin-top is most of the "big
         cube" shrink - not font sizes, which were already fairly small. */
      .portfolio-panel:not(.expanded) .tl-inner{ margin-top:4px !important; }
      .portfolio-panel:not(.expanded) .timeline-axis{ height:0 !important; margin-bottom:0 !important; }
      .individual-rows .tl-row{ margin-bottom:2px !important; }
      .individual-rows .tl-track{ height:12px !important; }
      .individual-rows .tl-label{ font-size:9px !important; }
      /* Year axis (2029, 2028, ...): engine.css never had a landscape size
         for this at all - only a narrow-PORTRAIT breakpoint (10px) exists,
         so landscape was falling all the way back to the 18px desktop
         base. Client's own explicit "at least 30% smaller" ask - 18*0.7=
         12.6, rounded to 13px. */
      .timeline-axis{ font-size:13px !important; }
      /* "היום"+date label sits in the ~28px gap between the summary bar
         above it and .tl-inner below it (engine.css's own spacing, not
         touched by this file's collapsed-state-only compression above) -
         only ~4-6px of real clearance on either side once expanded,
         client's own report that it read as overlapping the bar. A few
         more px of room here, expanded landscape only (the collapsed
         state's own margin-top:4px rule above is untouched). */
      .portfolio-panel.expanded .tl-inner{ margin-top:34px !important; }
      /* Client's own explicit follow-up: still too close to the bar above
         it even after the extra tl-inner margin - 3 more px down from
         engine.css's own top:-22px (relative to .today-line). */
      .today-label{ top:-19px !important; }
    }
    /* Portrait: cards run the full device width - no wasted side margins. */
    @media(max-width:900px) and (orientation:portrait){
      body.demo-compact-active #projects{ margin-inline:calc(50% - 50vw); gap:6px; }
      body.demo-compact-active .demo-mini-bar{ border-radius:0; border-inline:0; }
      /* engine.css's own 26px left/right padding on the weighted-completion
         widget's outer panel is sized for the full desktop layout - on a
         narrow phone it eats real width from the bars/timeline inside
         (measured: ~29px of unused margin on each side, bars only using
         277 of the panel's own 335px) - client's own explicit "why not
         widen it to the sides" ask. */
      .portfolio-panel{ padding-inline:10px !important; }
      /* engine.css's own -18px left/right margin on #agg-bar (a 900px-
         breakpoint rule, its own deliberate partial "bleed toward the
         edge" calibrated against THAT 26px padding above) started
         overflowing past the panel's own edge once padding shrunk to 10px
         - confirmed by measurement, the bar's own box actually extending
         5px beyond the panel on each side. Neutralized here so the
         reduced padding above is what actually controls the bar's width,
         not fighting a margin still assuming the old, wider padding. */
      #agg-bar{ margin-left:0 !important; margin-right:0 !important; }
      #agg-row .pc-top-row{ margin-left:0 !important; margin-right:0 !important; }
      #agg-row .agg-title{ margin-right:0 !important; }
      /* Same double-reservation issue landscape had (see the JS pinning
         .app's margin-top above): body's own unconditional 26px top
         padding (engine.css) sat on top of .app's own margin-top
         regardless, so even a tightened .app margin-top alone wouldn't
         shrink the gap the client is now also asking to reduce here. */
      body{ padding-top:0 !important; }
      /* Client's own explicit "the gap between the title and the line
         under it" ask - engine.css's own header padding (16px top/bottom)
         is roomier than needed once this is a compact mobile card list,
         not the full desktop layout it was sized for. */
      header{ padding-bottom:8px !important; }
      /* "פרויקטים בתיק" + "(לחצו לפירוט שלבים)": engine.css renders both as
         inline content in one flex row (.section-title{display:flex}) -
         fine on a wide desktop line, but on a narrow phone the whole row
         wraps mid-phrase wherever it runs out of room, not at a sensible
         boundary - client's own explicit ask for the title to always stay
         on its own single line, with the note below it on a second,
         smaller line. flex-wrap here + flex-basis:100% on the note is what
         forces that specific break, instead of leaving the wrap point to
         chance. */
      .section-title{ flex-wrap:wrap; }
      .section-title-note{ flex-basis:100%; font-size:11px; }
    }
  `;
  document.head.appendChild(style);
  // Now that the stylesheet above is actually in <head>, fabBar has its
  // real flex/padding layout and getBoundingClientRect().width inside
  // positionFabBar() reads its true ~83px size - safe to position it for
  // the first time here (see the comment by the now-deferred call above).
  positionFabBar();

  // ---------- Landscape phones only: pin the gap below the header to the
  // client's own "~0.5cm" spec by overriding .app's margin-top directly,
  // instead of the three earlier attempts that each wrote to document.
  // body's padding-top - a SEPARATE property that just stacked on top of
  // engine.js's own reservation instead of replacing it. Re-reading
  // engine.js's initHeaderBehavior() start to finish (instead of testing
  // another guess) is what surfaced this: engine.js already owns this
  // exact problem - .app's margin-top is written by its own
  // syncContentOffset() as header_height + 20px, kept in sync via its own
  // measureHeaderHeights() + a real retry schedule (350/1200/2500ms,
  // document.fonts.load/ready, resize, orientationchange, every scroll
  // past the compact-header threshold). Since app.style.marginTop is a
  // plain (non-important) assignment, whoever writes it LAST simply wins -
  // there's no real cascade between two writes to the same inline
  // property. This file's earlier fix never fought that write directly -
  // it wrote to body's padding-top instead, so BOTH ended up active and
  // additive: engine's own ~106px .app margin-top PLUS this file's own
  // ~105px body padding-top, roughly doubling the intended offset - the
  // "gap doubled" the client kept seeing, on every retry strategy tried.
  // engine's own +20px is already close to the client's own spec, but
  // body's own UNCONDITIONAL 26px top padding (engine.css, not header-
  // height-aware, zeroed for landscape in the CSS above) was always adding
  // on top of that too - even a perfectly correct engine.js alone rendered
  // a bigger landscape gap than the client wants.
  //
  // The correct fix pins .app's OWN margin-top to header_height+19px
  // directly, and - since engine.js will keep re-asserting its own +20px
  // formula on its own schedule regardless of anything this file does -
  // re-applies this override every single time .app's style attribute
  // changes for ANY reason, via a MutationObserver. That makes this file's
  // value the one that's ALWAYS last-written, permanently, without caring
  // when or why engine.js's own resync fires. Also disables .app's own
  // margin-top transition first: leaving it on could only extend, at most
  // 0.3s, how long a wrong intermediate value is briefly visible each time
  // this overrides an engine.js resync - never a reason for the WRONG
  // final value to persist, so this isn't the fix for the doubling bug
  // itself, just removes a possible source of a brief visible flash.
  // Portrait phones only: same doubling problem, same fix, client's own
  // later follow-up asking for the portrait header gap tightened too -
  // extended here (own smaller GAP, body's own unconditional 26px zeroed
  // for portrait too below in the stylesheet) rather than widening the
  // landscape-only check above, so a device-width match alone still can't
  // silently apply the WRONG orientation's gap value.
  if(window.MutationObserver){
    const app = document.querySelector('.app');
    const header = document.querySelector('header');
    const LANDSCAPE_GAP = 38; // client's own explicit "1cm" follow-up (~37.8px)
    const PORTRAIT_GAP = 15; // client's own later "tighten this too" follow-up
    let applyingOwnMargin = false;
    function currentGap(){
      if(window.matchMedia('(max-width:900px) and (orientation:landscape)').matches) return LANDSCAPE_GAP;
      if(window.matchMedia('(max-width:900px) and (orientation:portrait)').matches) return PORTRAIT_GAP;
      return null;
    }
    function pinAppMarginForMobile(){
      if(!app || !header) return;
      const gap = currentGap();
      if(gap === null) return;
      const target = (header.getBoundingClientRect().height + gap) + 'px';
      if(app.style.marginTop === target) return;
      applyingOwnMargin = true;
      app.style.setProperty('transition', 'none', 'important');
      app.style.setProperty('margin-top', target, 'important');
      applyingOwnMargin = false;
    }
    pinAppMarginForMobile();
    new MutationObserver(() => { if(!applyingOwnMargin) pinAppMarginForMobile(); })
      .observe(app, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', pinAppMarginForMobile);
    window.addEventListener('orientationchange', () => setTimeout(pinAppMarginForMobile, 50));
  }

  // ---------- Landscape phones only: size the filter chips as LARGE as
  // possible while still fitting every one of them on one line with no
  // scrolling - client's own correction to a previous round that just
  // picked one small fixed size everywhere ("too small now - they need to
  // fit the phone's actual width exactly"). Steps down through a few
  // tiers (via CSS custom properties the .filter-btn rule above reads)
  // until the row's own scrollWidth stops exceeding its clientWidth, or
  // the smallest tier is reached.
  const FILTER_CHIP_TIERS = [
    { pad: '6px 12px', font: '12px', gap: '6px' },
    { pad: '5px 10px', font: '11px', gap: '5px' },
    { pad: '4px 8px', font: '10px', gap: '4px' },
    { pad: '3px 6px', font: '9px', gap: '3px' },
    { pad: '2px 4px', font: '8px', gap: '2px' },
  ];
  function fitFilterChipsToWidth(){
    const bar = document.getElementById('projects-filter-bar');
    if(!bar) return;
    if(!window.matchMedia('(max-width:900px) and (orientation:landscape)').matches) return;
    for(const tier of FILTER_CHIP_TIERS){
      const [padV, padH] = tier.pad.split(' ');
      bar.style.setProperty('--fc-pad-v', padV);
      bar.style.setProperty('--fc-pad-h', padH);
      bar.style.setProperty('--fc-font', tier.font);
      bar.style.setProperty('--fc-gap', tier.gap);
      // Force a reflow read (not just set-and-hope) before checking fit.
      if(bar.scrollWidth <= bar.clientWidth + 1) break;
    }
  }
  // NOTE: the actual first call is deferred to just after the mode-toggle
  // button is inserted next to this bar, further down this file - inserting
  // that button is what changes #projects-filter-bar's own available width,
  // so fitting against its width here (before that insertion happens) would
  // measure against a too-wide, soon-to-shrink row and under-shrink the
  // chips, leaving them just barely too wide once the toggle lands next to
  // them - exactly the "still overflows / still scrolls" the client kept
  // seeing. The resize/orientationchange listeners below stay wired up now.
  window.addEventListener('resize', fitFilterChipsToWidth);
  window.addEventListener('orientationchange', () => setTimeout(fitFilterChipsToWidth, 50));

  // ---------- Landscape phones only: a real two-icon button (not a text
  // label - client's own explicit request) switching between the two
  // landscape layouts - "כרטיסיות" (demo-classic, 5x10-ish cards side by
  // side) and "רצועות" (the dense compact strip). Pure CSS switch via a
  // body class; every rule it affects lives inside the landscape-only
  // media queries, so desktop and portrait never change regardless of
  // which mode is saved. DEFAULT is now "כרטיסיות" (classic=true) when
  // nothing is saved yet - client's own explicit request, reversing the
  // previous default.
  const modeToggle = document.createElement('div');
  modeToggle.className = 'demo-mode-toggle';
  modeToggle.setAttribute('role', 'group');
  modeToggle.setAttribute('aria-label', 'תצוגת מובייל');
  modeToggle.innerHTML = `
    <button type="button" class="demo-mode-btn" data-mode="classic" aria-label="תצוגת כרטיסיות" title="תצוגת כרטיסיות">⊞</button>
    <button type="button" class="demo-mode-btn" data-mode="compact" aria-label="תצוגת רצועות" title="תצוגת רצועות">☰</button>
  `;
  const modeBtns = [...modeToggle.querySelectorAll('.demo-mode-btn')];
  function readMode(){ try{ return localStorage.getItem('demo-mobile-mode'); }catch(e){ return null; } }
  function writeMode(v){ try{ localStorage.setItem('demo-mobile-mode', v); }catch(e){} }
  function applyMode(mode){
    document.body.classList.toggle('demo-classic', mode === 'classic');
    modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  }
  applyMode(readMode() === 'compact' ? 'compact' : 'classic');
  modeBtns.forEach(b => b.addEventListener('click', () => {
    applyMode(b.dataset.mode);
    writeMode(b.dataset.mode);
  }));
  // Sits immediately to the right of the filter chips specifically (not
  // the whole sort/search toolbar) - client's own explicit placement
  // request - via a small dedicated row wrapping [toggle, nativeFilterBar]
  // together, toggle first in DOM (= rightmost in this RTL layout).
  if(nativeFilterBar){
    const filterRow = document.createElement('div');
    filterRow.className = 'demo-filter-row';
    nativeFilterBar.parentNode.insertBefore(filterRow, nativeFilterBar);
    filterRow.appendChild(modeToggle);
    filterRow.appendChild(nativeFilterBar);
  }
  // Now that the toggle actually occupies its share of the row, measure
  // and fit the chips for real (see the note by fitFilterChipsToWidth's
  // definition above for why this can't happen any earlier).
  fitFilterChipsToWidth();

  // ---------- Everywhere: the weighted-completion widget's own
  // "i" info icon must only ever open its tooltip - clicking it must not
  // ALSO toggle the widget's expand/collapse. #tl-bars-clip has its own
  // separate click-to-toggle bubble listener (engine.js) sitting BETWEEN
  // this icon and document, so it always fires first (bubble runs inner-
  // ancestor-first) - by the time any document-level listener could act,
  // the toggle has already happened. stopPropagation() can't selectively
  // skip just that one ancestor's handler while still letting the click
  // reach document normally (needed for engine.js's own tooltip-open
  // listener there, also document-level) - calling it anywhere before the
  // target blocks the ENTIRE rest of the trip, tooltip included, which a
  // first attempt at this fix confirmed the hard way. So instead of
  // preventing the toggle, this lets it happen and then un-does it: a
  // plain bubble listener on document (default phase, so it runs after
  // #tl-bars-clip's own bubble listener already fired, and after this
  // file's init means it also runs after engine.js's own same-phase
  // tooltip listener - all three coexist without conflict since each only
  // touches its own class).
  document.addEventListener('click', (e) => {
    if(e.target.closest('#tl-bars-clip .info-icon')){
      const panel = document.getElementById('timeline-wrap');
      const owner = panel && panel.closest('.portfolio-panel');
      if(owner) owner.classList.toggle('expanded');
    }
  });

  // ---------- Everywhere: shorten the "i" tooltip's own auto-dismiss
  // delay from engine.js's hardcoded 3000ms to the client's own explicit
  // 1500ms ask - originally landscape-mobile only, now applied everywhere
  // per the client's own "in every case" follow-up. Piggybacks on the
  // exact same click that opens it - this listener runs after engine.js's
  // own (added later, same bubble phase, same node), so by the time it
  // runs, .tip-open already reflects THIS click's own result - and just
  // races a shorter timer of its own. engine.js's own 3s timer still fires
  // too, but by then this one has already removed the class, so it's a
  // harmless no-op. Clicking the icon again to close it early already
  // works with no change needed (engine.js's own toggle handles that).
  document.addEventListener('click', (e) => {
    const icon = e.target.closest('.info-icon');
    if(!icon) return;
    clearTimeout(icon._demoTipTimer);
    if(icon.classList.contains('tip-open')){
      icon._demoTipTimer = setTimeout(() => {
        icon.classList.remove('tip-open');
        icon.classList.add('tip-dismissed');
      }, 1500);
    }
  });

  // ---------- Everywhere: two more click-handling corrections to
  // engine.js's own info-sheet behavior, both client-reported - originally
  // landscape-mobile only, now applied everywhere per the client's own
  // follow-up (both the "closes on an extra click inside" behavior and the
  // z-index fix were reported on desktop too). These two, unlike the fix
  // above, both only ever ADD behavior (close a panel, raise a z-index)
  // without needing to cancel anything engine.js already does, so a
  // document-level CAPTURE-phase listener works cleanly here - same
  // technique engine.js itself already uses for its own outside-click-
  // closes-everything listener (see its own comment there), chosen so this
  // runs before that inline .info-sheet onclick="stopPropagation()"
  // (engine.css's own comment on .info-sheet references it) has a chance
  // to matter - that inline handler only fires once the event bubbles back
  // up through the sheet itself, well after capture phase has already run.
  document.addEventListener('click', (e) => {
    // 1) A per-project info panel, once open, must close on an ADDITIONAL
    //    tap anywhere inside it too - engine.js's own listener deliberately
    //    keeps it open for clicks inside (correct for a mouse, where
    //    there's no other reason to click inside except reading), but the
    //    client's own explicit ask is for a further click to always close
    //    it, everywhere.
    const sheet = e.target.closest('.info-sheet');
    if(sheet){
      const owner = sheet.closest('[data-has-info]');
      if(owner){ clearTimeout(owner._infoCloseTimer); owner.classList.remove('info-open'); }
    }
    // 2) An open info-sheet was rendering UNDER the next card down the grid
    //    - z-index:40 on .info-sheet itself (engine.css) only ever wins
    //    against elements sharing ITS OWN stacking context, which is the
    //    tiny [data-has-info] title div it's absolutely positioned inside,
    //    not the sibling project cards it visually overlaps once open. What
    //    actually needs raising is the CARD itself, against ITS siblings -
    //    synced here (after engine.js's own capture-phase listeners above
    //    have already applied/removed .info-open for this same click) by
    //    just reflecting current .info-open state onto each card's own
    //    z-index every time something here could have changed it.
    document.querySelectorAll('.demo-info-raised').forEach(card => card.classList.remove('demo-info-raised'));
    document.querySelectorAll('[data-has-info].info-open').forEach(owner => {
      const card = owner.closest('.project-card, .demo-mini-bar');
      if(card) card.classList.add('demo-info-raised');
    });
  }, true);
})();
