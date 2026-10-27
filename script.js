const sections = [...document.querySelectorAll('#top, .stage')];
const tabs = [...document.querySelectorAll('.tabs a')];

// Mark the tab of the section under the header.
function updateTabs() {
  const offset = document.querySelector('.site-header').offsetHeight + 80;
  let current = 0;
  sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= offset) current = i; });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) current = sections.length - 1;
  tabs.forEach((a, i) => i === current ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
}
window.addEventListener('scroll', updateTabs, { passive: true });
window.addEventListener('resize', updateTabs);
updateTabs();

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Real-to-sim trajectories: a real demonstration and its simulation, played in lockstep (sim is the clock).
const r2s = document.querySelector('#r2s');
const [r2sReal, r2sSim] = r2s.querySelectorAll('video');
const r2sPlay = document.querySelector('.r2s__play');
const r2sSeek = document.querySelector('.r2s__seek');
const r2sTime = document.querySelector('.r2s__time');
let r2sWanted = !reduced, r2sVisible = false;
function r2sRun() {
  const go = r2sWanted && r2sVisible;
  for (const v of [r2sSim, r2sReal]) go ? v.play().catch(() => {}) : v.pause();
  r2sPlay.innerHTML = r2sWanted ? '&#10074;&#10074;' : '&#9654;';
  r2sPlay.setAttribute('aria-label', r2sWanted ? 'Pause' : 'Play');
}
function r2sSeekTo(t) { r2sSim.currentTime = t; r2sReal.currentTime = t; }
function r2sTick() {
  const t = r2sSim.currentTime, d = r2sSim.duration || 0;
  if (!r2sSim.paused && Math.abs(r2sReal.currentTime - t) > 0.12) r2sReal.currentTime = t;
  if (d && document.activeElement !== r2sSeek) r2sSeek.value = Math.round(1000 * t / d);
  r2sTime.textContent = d ? `${t.toFixed(1)} / ${d.toFixed(1)} s` : '';
  requestAnimationFrame(r2sTick);
}
requestAnimationFrame(r2sTick);
r2sSim.addEventListener('ended', () => { r2sSeekTo(0); r2sRun(); });   // loop the pair together
r2sPlay.addEventListener('click', () => { r2sWanted = !r2sWanted; r2sRun(); });
r2sSeek.addEventListener('input', () => r2sSeekTo(r2sSeek.value / 1000 * (r2sSim.duration || 0)));
new IntersectionObserver(([e]) => { r2sVisible = e.isIntersecting; r2sRun(); }, { threshold: 0.3 }).observe(r2s);
document.querySelectorAll('#real2sim .chips button').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('#real2sim .chips button').forEach(b => b.setAttribute('aria-selected', b === chip));
  for (const [v, side] of [[r2sReal, 'real'], [r2sSim, 'sim']]) {
    v.poster = `assets/r2s/${chip.dataset.task}_${side}.jpg`;
    v.src = `assets/r2s/${chip.dataset.task}_${side}.mp4`;
  }
  document.querySelector('#r2s-note').textContent = chip.dataset.note;
  r2sRun();
}));

// Randomized-demonstration browser: task -> kind of randomization -> episodes, with sampled values.
const dr = document.querySelector('#dr');
const DR = { task: null, kind: null, cam: 'camera_1', ep: null, data: null };
const fmt = (x, d = 2) => (x == null ? '—' : Number(x).toFixed(d).replace(/\.?0+$/, ''));
const scale = x => (x == null ? '—' : `×${fmt(x, 2)}`);
const words = s => s.replace(/_/g, ' ');
function card(p, kind) {
  const cam = DR.cam;
  const rows = [
    ['light', 'Lighting', `${p.lights} light${p.lights > 1 ? 's' : ''}, elevation ${p.light_elevation_deg.join('°, ')}° · direct ${p.direct_light} · ambient ${fmt(p.ambient, 3)}`],
    ['brightness', 'Brightness', `${fmt(p.brightness[cam], 0)} / 255 mean on this camera`],
    ['effect', 'Image effect', words(p.image_effect[cam] || 'none')],
    ['camera', 'Camera shift', p.camera_shift[cam] ? `${fmt(p.camera_shift[cam].rot_deg)}° rotation, ${fmt(p.camera_shift[cam].pos_mm, 1)} mm` : '—'],
  ];
  if (p.push) rows.push(['push', 'External push', p.push.map(x => `${words(x.object)} during ${words(x.phase)}: ${fmt(x.force_N)} N for ${fmt(x.duration_s)} s`).join('; ')]);
  const off = Object.entries(p.object_offset_mm).filter(([, v]) => v > 0);
  if (off.length) rows.push(['moved', 'Object offset', off.map(([k, v]) => `${words(k)} ${fmt(v, 1)} mm`).join(', ')]);
  if (p.mass_scale != null) rows.push(['heavy', 'Object mass', scale(p.mass_scale)]);
  if (p.friction_scale != null) rows.push(['slippery', 'Friction', scale(p.friction_scale)]);
  rows.push(['slow_gripper', 'Gripper speed', scale(p.gripper_speed_scale)], ['soft_arm', 'Arm stiffness', scale(p.joint_stiffness_scale)]);
  const hot = DR.kind.hot;   // card rows behind the selected kind
  return rows.map(([id, k, v]) => `<div${hot.includes(id) ? ' class="hot"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
function clip(ep) { return `assets/dr/${DR.task.id}/ep${String(ep).padStart(4, '0')}_${DR.cam.slice(-1)}`; }
function showEpisode(ep) {
  DR.ep = ep;
  const v = dr.querySelector('.dr__player video');
  v.poster = clip(ep) + '.jpg'; v.src = clip(ep) + '.mp4';
  if (!reduced) v.play().catch(() => {}); else v.controls = true;
  dr.querySelector('.dr__card').innerHTML = `<div class="dr__title"><dt>Episode</dt><dd>${ep}</dd></div>` + card(DR.task.episodes[ep], DR.kind.kind);
  dr.querySelectorAll('.dr__grid button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.ep === ep));
}
function showKind(kind) {
  DR.kind = kind;
  dr.querySelectorAll('.dr__kinds button').forEach(b => b.setAttribute('aria-selected', b.dataset.kind === kind.kind));
  dr.querySelector('.dr__grid').innerHTML = kind.episodes.map(ep => `
    <button data-ep="${ep}" aria-pressed="false" aria-label="Episode ${ep}">
      <video src="${clip(ep)}.mp4" poster="${clip(ep)}.jpg" muted loop playsinline preload="none"></video></button>`).join('');
  dr.querySelectorAll('.dr__grid button').forEach(b => {
    const v = b.querySelector('video');
    b.addEventListener('click', () => showEpisode(+b.dataset.ep));
    if (!reduced) { b.addEventListener('mouseenter', () => v.play().catch(() => {})); b.addEventListener('mouseleave', () => v.pause()); }
  });
  showEpisode(kind.episodes.includes(DR.ep) ? DR.ep : kind.episodes[0]);
}
function kindsFor(task) {   // camera-specific kinds follow the camera toggle
  return task.kinds.filter(k => !k.camera || k.camera === DR.cam);
}
function showTask(task, keepKind) {
  DR.task = task;
  dr.querySelectorAll('.dr__tasks button').forEach(b => b.setAttribute('aria-selected', b.dataset.task === task.id));
  const kinds = kindsFor(task);
  dr.querySelector('.dr__kinds').innerHTML = kinds.map(k =>
    `<button role="tab" data-kind="${k.kind}" aria-selected="false" title="${k.description}">${k.label}</button>`).join('');
  dr.querySelectorAll('.dr__kinds button').forEach(b => b.addEventListener('click', () => showKind(kinds.find(k => k.kind === b.dataset.kind))));
  showKind(kinds.find(k => k.kind === keepKind) || kinds[0]);
}
fetch('assets/dr/index.json').then(r => r.json()).then(data => {
  DR.data = data;
  dr.querySelector('.dr__tasks').innerHTML = data.tasks.map(t =>
    `<button role="tab" data-task="${t.id}" aria-selected="false">${t.label}</button>`).join('');
  dr.querySelectorAll('.dr__tasks button').forEach(b => b.addEventListener('click', () => showTask(data.tasks.find(t => t.id === b.dataset.task))));
  dr.querySelectorAll('.dr__cams button').forEach(b => b.addEventListener('click', () => {
    DR.cam = b.dataset.cam;
    dr.querySelectorAll('.dr__cams button').forEach(x => x.setAttribute('aria-pressed', x === b));
    showTask(DR.task, DR.kind.kind);
  }));
  // deep link: #dr/<task>/<camera>/<kind>[/<episode>], e.g. #dr/cup/camera_2/push
  const [, task, cam, kind, ep] = location.hash.split('/');
  const t = location.hash.startsWith('#dr/') && data.tasks.find(x => x.id === task);
  if (t && data.cameras.includes(cam)) {
    DR.cam = cam;
    dr.querySelectorAll('.dr__cams button').forEach(x => x.setAttribute('aria-pressed', x.dataset.cam === cam));
    if (ep) DR.ep = +ep;
    showTask(t, kind);
    dr.scrollIntoView();
  } else showTask(data.tasks[0]);
});

// Rollout viewer: one successful real rollout at a time; task tabs (mug first) and left/right buttons
// step through three trials per task. The clip plays only while on screen.
// Where a task has more than three successes, SHOW picks trials with different starting layouts
// (mug: far from the stand, handle toward the camera, close to the stand; tape: roll far from, close to
// and behind the box; cup: one trial from each distinct triangle arrangement).
const SHOW = { mug_hanging_1016: ['mug_08.mp4', 'mug_09.mp4', 'mug_10.mp4'],
               tape_box_lid_1023: ['tape_01.mp4', 'tape_04.mp4', 'tape_06.mp4'],
               cup_nesting_1025: ['cup_02.mp4', 'cup_04.mp4', 'cup_07.mp4'] };
const TASKS = [['mug_hanging_1016', 'Mug hanging'], ['tape_box_lid_1023', 'Tape in box'],
               ['cup_nesting_1025', 'Cup nesting'],
               ['whiteboard_wiping_1025', 'Whiteboard wiping'], ['cable_routing_1025_wide50', 'Cable routing']];
fetch('assets/deploy/clips.json').then(r => r.json()).then(({ clips }) => {
  const viewer = document.querySelector('#gallery');
  const tabs = document.querySelector('#gallery-tasks');
  const video = viewer.querySelector('video');
  const count = viewer.querySelector('.gallery__count');
  const sets = Object.fromEntries(TASKS.map(([task]) => {
    const ok = clips.filter(c => c.task === task && c.outcome === 'success');
    return [task, SHOW[task] ? SHOW[task].map(f => ok.find(c => c.clip === f)).filter(Boolean) : ok.slice(0, 3)];
  }));
  const G = { task: TASKS[0][0], i: 0, visible: false };
  function show() {
    const set = sets[G.task], c = set[G.i];
    video.poster = `assets/deploy/${c.poster}`;
    video.src = `assets/deploy/${c.clip}`;
    video.setAttribute('aria-label', `${TASKS.find(t => t[0] === G.task)[1]}: successful real rollout ${G.i + 1} of ${set.length}`);
    count.textContent = `${G.i + 1} / ${set.length}`;
    viewer.querySelectorAll('.gallery__nav').forEach(b => { b.hidden = set.length < 2; });
    if (G.visible && !reduced) video.play().catch(() => {});
  }
  function step(d) { const n = sets[G.task].length; G.i = (G.i + d + n) % n; show(); }
  tabs.innerHTML = TASKS.map(([task, label], k) =>
    `<button role="tab" data-task="${task}" aria-selected="${k === 0}">${label}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x === b));
    G.task = b.dataset.task; G.i = 0; show();
  }));
  viewer.querySelector('.gallery__nav--prev').addEventListener('click', () => step(-1));
  viewer.querySelector('.gallery__nav--next').addEventListener('click', () => step(1));
  new IntersectionObserver(([e]) => {
    G.visible = e.isIntersecting;
    if (reduced) return;
    G.visible ? video.play().catch(() => {}) : video.pause();
  }, { threshold: 0.35 }).observe(video);
  if (reduced) video.controls = true;
  show();
});

// Respect reduced motion: show posters, play only on request.
if (reduced) {
  document.querySelectorAll('video[autoplay]').forEach(v => { v.removeAttribute('autoplay'); v.pause(); v.controls = true; });
}
