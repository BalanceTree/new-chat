/* weather-api.js — Open-Meteo 멀티모델 실시간 날씨 분석 */
(function () {
  const LAT = 35.6762, LON = 139.6503;
  const DATES = ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];

  const MODELS = [
    { id: 'ecmwf_ifs025',        name: 'ECMWF IFS',  flag: '🌍' },
    { id: 'gfs_seamless',        name: 'NOAA GFS',   flag: '🌎' },
    { id: 'jma_seamless',        name: 'JMA 기상청', flag: '🗾' },
  ];

  const WMO_ICON = wcode => {
    if (wcode == null) return null;
    if (wcode === 0)           return '☀️';
    if (wcode <= 3)            return wcode <= 1 ? '🌤️' : wcode <= 2 ? '⛅' : '☁️';
    if (wcode <= 48)           return '🌫️';
    if (wcode <= 67)           return wcode <= 51 ? '🌦️' : wcode <= 61 ? '🌧️' : '🌧️';
    if (wcode <= 77)           return '❄️';
    if (wcode <= 82)           return '🌧️';
    if (wcode <= 99)           return '⛈️';
    return '🌧️';
  };

  const avg  = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const round = v  => Math.round(v);

  function buildUrl(modelId) {
    return (
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${LAT}&longitude=${LON}` +
      `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min,weathercode` +
      `&timezone=Asia%2FTokyo` +
      `&start_date=${DATES[0]}&end_date=${DATES[DATES.length - 1]}` +
      `&models=${modelId}`
    );
  }

  /* ── 패치 & 집계 ── */
  Promise.allSettled(
    MODELS.map(m =>
      fetch(buildUrl(m.id))
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => ({ model: m, daily: data.daily }))
    )
  ).then(results => {
    const succeeded = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (!succeeded.length) return; // 전부 실패 → 하드코딩 유지

    /* 날짜별 집계 */
    const byDate = DATES.map(date => {
      const vals = succeeded.map(({ model, daily }) => {
        const idx = (daily.time || []).indexOf(date);
        if (idx === -1) return null;
        return {
          modelName : model.name,
          modelFlag : model.flag,
          precip    : daily.precipitation_probability_max?.[idx] ?? null,
          tmax      : daily.temperature_2m_max?.[idx]            ?? null,
          tmin      : daily.temperature_2m_min?.[idx]            ?? null,
          wcode     : daily.weathercode?.[idx]                   ?? null,
        };
      }).filter(Boolean);

      if (!vals.length) return { date, ok: false };

      const precips = vals.map(v => v.precip).filter(v => v != null);
      const tmaxs   = vals.map(v => v.tmax  ).filter(v => v != null);
      const tmins   = vals.map(v => v.tmin  ).filter(v => v != null);
      const wcodes  = vals.map(v => v.wcode ).filter(v => v != null);

      /* 강수확률 → 가장 높은 값 기준(보수적 집계) + 범위 */
      const precipAvg = precips.length ? round(avg(precips)) : null;
      const precipLo  = precips.length ? round(Math.min(...precips)) : null;
      const precipHi  = precips.length ? round(Math.max(...precips)) : null;
      const spread    = precipHi - precipLo;

      /* 기온 평균 */
      const tmaxAvg = tmaxs.length ? round(avg(tmaxs)) : null;
      const tminAvg = tmins.length ? round(avg(tmins)) : null;

      /* 대표 날씨 코드 — 가장 나쁜 값 채택 */
      const wcodeRepr = wcodes.length ? Math.max(...wcodes) : null;

      return { date, ok: true, precipAvg, precipLo, precipHi, spread, tmaxAvg, tminAvg, wcodeRepr, vals };
    });

    updateCards(byDate);
    renderModelPanel(byDate, succeeded.map(s => s.model));
    updateBadge(succeeded.length);
  });

  /* ── 날씨 카드 업데이트 ── */
  function updateCards(byDate) {
    document.querySelectorAll('.days .day').forEach(el => {
      const dateEl = el.querySelector('.date');
      if (!dateEl) return;
      const day  = dateEl.textContent.trim();
      const info = byDate.find(d => d.date.endsWith(`-${day.padStart(2, '0')}`));
      if (!info || !info.ok) return;

      const hiEl   = el.querySelector('.hi');
      const loEl   = el.querySelector('.lo');
      const rainEl = el.querySelector('.rain');
      const icoEl  = el.querySelector('.ico');

      if (hiEl && info.tmaxAvg != null) hiEl.textContent = info.tmaxAvg + '°';
      if (loEl && info.tminAvg != null) loEl.textContent = '최저 ' + info.tminAvg + '°';

      if (rainEl && info.precipAvg != null) {
        const spreadTxt = info.spread > 20
          ? ` <span class="model-spread">${info.precipLo}~${info.precipHi}%</span>`
          : '';
        rainEl.innerHTML = `비 ${info.precipAvg}%${spreadTxt}`;
        rainEl.className = 'rain' +
          (info.precipAvg >= 70 ? ' hi-rain' : info.precipAvg <= 40 ? ' low-rain' : '');
      }

      if (icoEl && info.wcodeRepr != null) {
        const ic = WMO_ICON(info.wcodeRepr);
        if (ic) icoEl.textContent = ic;
      }

      /* wet / heavy 클래스 갱신 → 빗방울 애니 동기화 */
      el.classList.toggle('wet',   (info.precipAvg ?? 0) >= 50);
      el.classList.toggle('heavy', (info.precipAvg ?? 0) >= 75);
    });
  }

  /* ── 모델 분석 패널 렌더 ── */
  function renderModelPanel(byDate, usedModels) {
    const box = document.getElementById('model-analysis');
    if (!box) return;

    const dayLabels = ['18(목)', '19(금)', '20(토)', '21(일)'];

    let html = `<div class="ma-title">📡 모델별 강수확률 비교 <span class="ma-note">(${usedModels.length}개 모델 분석)</span></div>`;
    html += '<div class="ma-table-wrap"><table class="ma-table"><thead><tr><th>모델</th>';
    dayLabels.forEach(d => { html += `<th>${d}</th>`; });
    html += '</tr></thead><tbody>';

    usedModels.forEach(m => {
      html += `<tr><td class="ma-model">${m.flag} ${m.name}</td>`;
      byDate.forEach(info => {
        const val = info.vals?.find(v => v.modelName === m.name);
        if (!val || val.precip == null) {
          html += '<td class="ma-na">—</td>';
        } else {
          const p = round(val.precip);
          const cls = p >= 70 ? 'hi' : p <= 40 ? 'lo' : '';
          html += `<td class="ma-p ${cls}">${p}%</td>`;
        }
      });
      html += '</tr>';
    });

    /* 평균 행 */
    html += '<tr class="ma-avg-row"><td>평균</td>';
    byDate.forEach(info => {
      if (!info.ok || info.precipAvg == null) { html += '<td>—</td>'; return; }
      const cls = info.precipAvg >= 70 ? 'hi' : info.precipAvg <= 40 ? 'lo' : '';
      html += `<td class="ma-p ${cls}"><b>${info.precipAvg}%</b></td>`;
    });
    html += '</tr></tbody></table></div>';

    /* 모델 간 의견 일치 여부 */
    const consensusNotes = byDate.map((info, i) => {
      if (!info.ok || info.spread == null) return null;
      if (info.spread > 25) return `${dayLabels[i]} 모델 편차 크게 갈림 (${info.precipLo}~${info.precipHi}%)`;
      return null;
    }).filter(Boolean);

    if (consensusNotes.length) {
      html += `<div class="ma-warn">⚠️ ${consensusNotes.join(' · ')}</div>`;
    } else {
      html += `<div class="ma-ok">✅ 모델 간 예보 비교적 일치</div>`;
    }

    box.innerHTML = html;
    box.style.display = 'block';
  }

  /* ── 갱신 시각 배지 ── */
  function updateBadge(n) {
    const now = new Date();
    const fmt = t => String(t).padStart(2, '0');
    const txt = `실시간 갱신 · ${n}개 모델 평균 · `
              + `${now.getMonth() + 1}/${now.getDate()} ${fmt(now.getHours())}:${fmt(now.getMinutes())}`;
    const badge = document.querySelector('.hero .updated');
    if (badge) badge.textContent = txt;
  }

})();
