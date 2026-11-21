// Test: apakah IP ini masih punya kuota ZeroGPU untuk LTX (text-to-video) di HF Spaces.
// Join antrean, pantau event SSE. process_starts = GPU dialokasikan (kuota ada).
// Error berbau "quota" = kuota habis. Berhenti setelah complete/error/timeout 5 menit.
const SPACE = 'https://lightricks-ltx-video-distilled.hf.space';
const NAME = 'text-to-video';
const data = [
  'a small paper boat floating on calm water, gentle waves, sunny day',
  'worst quality, inconsistent motion, blurry, jittery, distorted, watermark',
  null, null, 704, 512, 'text-to-video', 2, 9, 42, true, 1, true,
];
const t0 = Date.now();
const el = () => Math.round((Date.now() - t0) / 1000) + 's';
(async () => {
  console.log('JOIN', SPACE + '/gradio_api/call/' + NAME);
  const jr = await fetch(SPACE + '/gradio_api/call/' + NAME, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  console.log('join HTTP', jr.status, el());
  const jtext = await jr.text();
  console.log('join body:', jtext.slice(0, 500));
  let eventId = null;
  try { eventId = JSON.parse(jtext).event_id; } catch {}
  if (!eventId) { console.log('RESULT: NO_EVENT_ID (ditolak di join)'); process.exit(0); }
  console.log('event_id:', eventId);
  const res = await fetch(SPACE + '/gradio_api/call/' + NAME + '/' + eventId);
  console.log('stream HTTP', res.status, el());
  if (!res.ok || !res.body) { console.log('RESULT: STREAM_FAIL'); process.exit(0); }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const lines = chunk.split('\n');
      const ev = (lines.find(l => l.startsWith('event:')) || '').slice(6).trim();
      const dt = (lines.find(l => l.startsWith('data:')) || '').slice(5).trim();
      console.log('EVENT', ev, el(), dt.slice(0, 300));
      if (ev === 'complete') { console.log('RESULT: COMPLETE'); console.log('OUTPUT:', dt.slice(0, 1000)); process.exit(0); }
      if (ev === 'error') { console.log('RESULT: ERROR_EVENT'); process.exit(0); }
    }
  }
  console.log('RESULT: TIMEOUT_5M (belum complete; lihat event terakhir di atas)');
  process.exit(0);
})().catch(e => { console.log('RESULT: EXCEPTION', e.message); process.exit(0); });
