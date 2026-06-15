/* weather-api.js — Open-Meteo 멀티모델 + 대기질 실시간 분석 */
(function () {
  const LAT = 35.6762, LON = 139.6503;
  const DATES = ['2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
  const DAY_LABELS = ['18(목)', '19(금)', '20(토)', '21(일)'];

  const MODELS = [
    { id: 'ecmwf_ifs025',        name: 'ECMWF IFS',     flag: '🌍' },
    { id: 'gfs_seamless',        name: 'NOAA GFS',      flag: '🌎' },
    { id: 'jma_seamless',        name: 'JMA 기상청',    flag: '🗾' },
    { id: 'icon_seamless',       name: 'DWD ICON',      flag: '🇩🇪' },
    { id: 'meteofrance_seamless',name: 'Météo-France',  flag: '🇫🇷' },
  ];

  const DAILY_PARAMS = [
    'precipitation_probability_max',
    'precipitation_sum',
    'temperature_2m_max',
    'temperature_2m_min',
    'apparent_temperature_max',
    'weathercode',
    'windspeed_10m_max',
    'relative_humidity_2m_max',
    'uv_index_max',
  ].join(',');

  /* WMO 코드 → 아이콘 */
  const WMO_ICON = c => {
    if (c == null) return null;
    if (c === 0)   return '☀️';
    if (c <= 1)    return '🌤️';
    if (c <= 2)    return '⛅';
    if (c <= 3)    return '☁️';
    if (c <= 48)   return '🌫️';
    if (c <= 55)   return '🌦️';
    if (c <= 67)   return '🌧️';
    if (c <= 77)   return '❄️';
    if (c <= 82)   return '🌧️';
    return '⛈️';
  };

  /* WMO 코드 → 한국어 상태 */
  const WMO_TEXT = c => {
    if (c == null) return null;
    if (c === 0)   return '맑음';
    if (c <= 1)    return '대체로 맑음';
    if (c <= 2)    return '구름 많음';
    if (c <= 3)    return '흐림';
    if (c <= 48)   return '안개';
    if (c <= 53)   return '이슬비';
    if (c <= 55)   return '짙은 이슬비';
    if (c <= 63)   return '비';
    if (c <= 65)   return '강한 비';
    if (c <= 82)   return '소나기';
    return '뇌우';
  };

  /* AQI → 등급 */
  const AQI_LABEL = v => {
    if (v == null) return null;
    if (v <= 50)  return { txt: '좋음',   cls: 'aqi-good' };
    if (v <= 100) return { txt: '보통',   cls: 'aqi-mod'  };
    if (v <= 150) return { txt: '나쁨',   cls: 'aqi-bad'  };
    return            { txt: '매우나쁨', cls: 'aqi-very'  };
  };

  const avg  = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const round = v  => Math.round(v * 10) / 10;
  const ri   = v  => Math.round(v);

  function buildUrl(modelId) {
    return (
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&daily=${DAILY_PARAMS}` +
      `&timezone=Asia%2FTokyo` +
      `&start_date=${DATES[0]}&end_date=${DATES[DATES.length - 1]}` +
      `&models=${modelId}`
    );
  }

  const AQI_URL =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&hourly=us_aqi,pm10,pm2_5` +
    `&timezone=Asia%2FTokyo` +
    `&start_date=${DATES[0]}&end_date=${DATES[DATES.length - 1]}`;

  /* ── 병렬 호출 ── */
  const modelFetches = MODELS.map(m =>
    fetch(buildUrl(m.id))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => ({ model: m, daily: data.daily }))
  );

  const aqiFetch = fetch(AQI_URL)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);

  Promise.all([Promise.allSettled(modelFetches), aqiFetch])
    .then(([modelResults, aqiData]) => {
      const succeeded = modelResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

      if (!succeeded.length) return;

      /* ── 날짜별 집계 ── */
      const byDate = DATES.map(date => {
        const vals = succeeded.map(({ model, daily }) => {
          const idx = (daily.time || []).indexOf(date);
          if (idx === -1) return null;
          const g = k => daily[k]?.[idx] ?? null;
          return {
            modelName : model.name,
            modelFlag : model.flag,
            precip    : g('precipitation_probability_max'),
            precipMm  : g('precipitation_sum'),
            tmax      : g('temperature_2m_max'),
            tmin      : g('temperature_2m_min'),
            feels     : g('apparent_temperature_max'),
            wcode     : g('weathercode'),
            wind      : g('windspeed_10m_max'),
            humid     : g('relative_humidity_2m_max'),
            uv        : g('uv_index_max'),
          };
        }).filter(Boolean);

        if (!vals.length) return { date, ok: false };

        const pick = k => vals.map(v => v[k]).filter(v => v != null);
        const pa = pick('precip'), ma = pick('precipMm'), ta = pick('tmax'),
              na = pick('tmin'), fa = pick('feels'), wa = pick('wind'),
              ha = pick('humid'), ua = pick('uv'),
              wcodes = pick('wcode');

        const precipAvg = pa.length ? ri(avg(pa)) : null;
        const precipLo  = pa.length ? ri(Math.min(...pa)) : null;
        const precipHi  = pa.length ? ri(Math.max(...pa)) : null;

        return {
          date, ok: true,
          precipAvg, precipLo, precipHi,
          spread  : precipHi - precipLo,
          precipMm: ma.length ? round(avg(ma)) : null,
          tmaxAvg : ta.length ? round(avg(ta)) : null,
          tminAvg : na.length ? round(avg(na)) : null,
          feelsAvg: fa.length ? round(avg(fa)) : null,
          windAvg : wa.length ? round(avg(wa)) : null,
          humidAvg: ha.length ? ri(avg(ha)) : null,
          uvAvg   : ua.length ? round(avg(ua)) : null,
          wcodeRepr: wcodes.length ? Math.max(...wcodes) : null,
          vals,
        };
      });

      /* ── 대기질 일별 최대 AQI ── */
      const aqiByDate = {};
      if (aqiData?.hourly?.time) {
        const { time, us_aqi, pm10, pm2_5 } = aqiData.hourly;
        DATES.forEach(date => {
          const idxs = time.reduce((a, t, i) => t.startsWith(date) ? [...a, i] : a, []);
          const aqis = idxs.map(i => us_aqi[i]).filter(v => v != null);
          const pm10s = idxs.map(i => pm10[i]).filter(v => v != null);
          const pm25s = idxs.map(i => pm2_5[i]).filter(v => v != null);
          aqiByDate[date] = {
            aqi : aqis.length  ? ri(avg(aqis))  : null,
            pm10: pm10s.length ? round(avg(pm10s)) : null,
            pm25: pm25s.length ? round(avg(pm25s)) : null,
          };
        });
      }

      updateCards(byDate, aqiByDate);
      renderPanel(byDate, aqiByDate, succeeded.map(s => s.model));
      updateBadge(succeeded.length, aqiData != null);
    });

  /* ── 날씨 카드 업데이트 ── */
  function updateCards(byDate, aqiByDate) {
    document.querySelectorAll('.days .day').forEach(el => {
      const dateEl = el.querySelector('.date');
      if (!dateEl) return;
      const day  = dateEl.textContent.trim();
      const dateStr = `2026-06-${day.padStart(2, '0')}`;
      const d = byDate.find(x => x.date === dateStr);
      if (!d || !d.ok) return;

      const set = (sel, html) => { const e = el.querySelector(sel); if (e) e.innerHTML = html; };

      if (d.tmaxAvg != null) set('.hi', d.tmaxAvg + '°');
      if (d.tminAvg != null) set('.lo', '최저 ' + d.tminAvg + '°');

      if (d.precipAvg != null) {
        const spread = d.spread > 20
          ? ` <span class="model-spread">(${d.precipLo}~${d.precipHi}%)</span>` : '';
        const mm = d.precipMm != null && d.precipMm > 0
          ? ` <span class="rain-mm">${d.precipMm}mm</span>` : '';
        set('.rain',
          `비 ${d.precipAvg}%${spread}${mm}`
        );
        el.querySelector('.rain').className = 'rain' +
          (d.precipAvg >= 70 ? ' hi-rain' : d.precipAvg <= 40 ? ' low-rain' : '');
      }

      if (d.wcodeRepr != null) {
        const ic = WMO_ICON(d.wcodeRepr);
        if (ic) set('.ico', ic);
      }

      /* 체감·바람 서브텍스트 */
      let extra = '';
      if (d.feelsAvg != null) extra += `체감 ${d.feelsAvg}°`;
      if (d.windAvg  != null) extra += `${extra ? ' · ' : ''}💨${d.windAvg}km/h`;
      if (d.humidAvg != null) extra += `${extra ? ' · ' : ''}💧${d.humidAvg}%`;

      let existingExtra = el.querySelector('.card-extra');
      if (!existingExtra) {
        existingExtra = document.createElement('div');
        existingExtra.className = 'card-extra';
        el.appendChild(existingExtra);
      }
      existingExtra.textContent = extra;

      /* 대기질 */
      const aq = aqiByDate[dateStr];
      const aqLabel = aq ? AQI_LABEL(aq.aqi) : null;
      let aqEl = el.querySelector('.card-aqi');
      if (aqLabel) {
        if (!aqEl) { aqEl = document.createElement('div'); aqEl.className = 'card-aqi'; el.appendChild(aqEl); }
        aqEl.innerHTML = `<span class="${aqLabel.cls}">AQI ${aqLabel.txt}</span>`;
      }

      el.classList.toggle('wet',   (d.precipAvg ?? 0) >= 50);
      el.classList.toggle('heavy', (d.precipAvg ?? 0) >= 75);
    });
  }

  /* ── 모델 분석 패널 ── */
  function renderPanel(byDate, aqiByDate, usedModels) {
    const box = document.getElementById('model-analysis');
    if (!box) return;

    /* 강수확률 비교 테이블 */
    let html = `<div class="ma-title">📡 멀티모델 분석 <span class="ma-note">${usedModels.length}개 기상 모델</span></div>`;
    html += '<div class="ma-table-wrap"><table class="ma-table"><thead><tr><th>모델</th>';
    DAY_LABELS.forEach(d => { html += `<th>${d}</th>`; });
    html += '</tr></thead><tbody>';

    usedModels.forEach(m => {
      html += `<tr><td class="ma-model">${m.flag} ${m.name}</td>`;
      byDate.forEach(info => {
        const val = info.vals?.find(v => v.modelName === m.name);
        if (!val || val.precip == null) { html += '<td class="ma-na">—</td>'; return; }
        const p = ri(val.precip);
        const cls = p >= 70 ? 'hi' : p <= 40 ? 'lo' : '';
        const mm = val.precipMm != null && val.precipMm > 0
          ? `<br><span class="ma-mm">${round(val.precipMm)}mm</span>` : '';
        html += `<td class="ma-p ${cls}">${p}%${mm}</td>`;
      });
      html += '</tr>';
    });

    html += '<tr class="ma-avg-row"><td>📊 평균</td>';
    byDate.forEach(info => {
      if (!info.ok || info.precipAvg == null) { html += '<td>—</td>'; return; }
      const cls = info.precipAvg >= 70 ? 'hi' : info.precipAvg <= 40 ? 'lo' : '';
      const mm = info.precipMm != null && info.precipMm > 0
        ? `<br><span class="ma-mm">${info.precipMm}mm</span>` : '';
      html += `<td class="ma-p ${cls}"><b>${info.precipAvg}%</b>${mm}</td>`;
    });
    html += '</tr></tbody></table></div>';

    /* 상세 지표 패널 */
    html += '<div class="ma-stats-grid">';
    byDate.forEach((info, i) => {
      if (!info.ok) return;
      const aq = aqiByDate[info.date];
      const aqLabel = aq ? AQI_LABEL(aq.aqi) : null;
      const wTxt = WMO_TEXT(info.wcodeRepr);
      html += `<div class="ma-stat-card">
        <div class="ma-stat-day">${DAY_LABELS[i]}</div>
        ${wTxt ? `<div class="ma-stat-cond">${WMO_ICON(info.wcodeRepr)} ${wTxt}</div>` : ''}
        ${info.feelsAvg != null ? `<div class="ma-stat-row"><span>체감 최고</span><span>${info.feelsAvg}°</span></div>` : ''}
        ${info.windAvg  != null ? `<div class="ma-stat-row"><span>최대 풍속</span><span>${info.windAvg} km/h</span></div>` : ''}
        ${info.humidAvg != null ? `<div class="ma-stat-row"><span>최대 습도</span><span>${info.humidAvg}%</span></div>` : ''}
        ${info.uvAvg    != null ? `<div class="ma-stat-row"><span>UV 지수</span><span>${uvLabel(info.uvAvg)}</span></div>` : ''}
        ${aq?.aqi       != null ? `<div class="ma-stat-row"><span>대기질 AQI</span><span class="${aqLabel?.cls || ''}">${aq.aqi} ${aqLabel?.txt || ''}</span></div>` : ''}
        ${aq?.pm10      != null ? `<div class="ma-stat-row"><span>PM10</span><span>${aq.pm10} μg/m³</span></div>` : ''}
        ${aq?.pm25      != null ? `<div class="ma-stat-row"><span>PM2.5</span><span>${aq.pm25} μg/m³</span></div>` : ''}
      </div>`;
    });
    html += '</div>';

    /* 편차 경고 */
    const warns = byDate.filter(d => d.ok && (d.spread ?? 0) > 25)
      .map(d => `${DAY_LABELS[DATES.indexOf(d.date)]} 모델 편차 ${d.precipLo}~${d.precipHi}%`);
    html += warns.length
      ? `<div class="ma-warn">⚠️ ${warns.join(' · ')}</div>`
      : `<div class="ma-ok">✅ 모델 간 예보 비교적 일치</div>`;

    box.innerHTML = html;
    box.style.display = 'block';
  }

  function uvLabel(v) {
    if (v == null) return '—';
    const n = Math.round(v);
    const lv = v <= 2 ? '낮음' : v <= 5 ? '보통' : v <= 7 ? '높음' : v <= 10 ? '매우높음' : '위험';
    return `${n} (${lv})`;
  }

  function updateBadge(modelN, hasAqi) {
    const now = new Date();
    const f = t => String(t).padStart(2, '0');
    const extra = hasAqi ? ' · 대기질 포함' : '';
    const txt = `실시간 갱신 · ${modelN}개 모델 평균${extra} · ${now.getMonth()+1}/${now.getDate()} ${f(now.getHours())}:${f(now.getMinutes())}`;
    const badge = document.querySelector('.hero .updated');
    if (badge) badge.textContent = txt;
  }
})();
