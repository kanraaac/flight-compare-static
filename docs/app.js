(function () {
  "use strict";

  const KO_CITY_TO_IATA = {
    부산: "PUS", 김해: "PUS", 서울: "ICN", 인천: "ICN", 김포: "GMP", 제주: "CJU",
    대구: "TAE", 청주: "CJJ", 광주: "KWJ", 여수: "RSU", 울산: "USN",
    오사카: "KIX", 간사이: "KIX", 도쿄: "NRT", 나리타: "NRT", 하네다: "HND",
    후쿠오카: "FUK", 나고야: "NGO", 삿포로: "CTS", 오키나와: "OKA",
    busan: "PUS", gimhae: "PUS", seoul: "ICN", incheon: "ICN", gimpo: "GMP",
    jeju: "CJU", osaka: "KIX", kansai: "KIX", tokyo: "NRT", narita: "NRT",
    haneda: "HND", fukuoka: "FUK",
  };
  const KR_IATA = new Set(["ICN","GMP","PUS","CJU","TAE","CJJ","KWJ","RSU","USN","WJU","MWX","HIN"]);
  const JP_IATA = new Set(["NRT","HND","KIX","ITM","NGO","FUK","CTS","OKA","HIJ","KOJ","KMJ","SDJ","UKB","FSZ"]);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const IATA_RE = /^[A-Z]{3}$/;

  const SOURCE_FIELDS = [
    { id: "google", label: "Google" },
    { id: "skyscanner", label: "Skyscanner" },
    { id: "naver", label: "Naver" },
    { id: "kayak", label: "Kayak" },
    { id: "lcc", label: "LCC 공식" },
    { id: "airline", label: "항공사 직판" },
  ];

  function normalizeIata(input) {
    const raw = String(input || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    if (IATA_RE.test(upper)) return upper;
    const mapped = KO_CITY_TO_IATA[raw.toLowerCase()] || KO_CITY_TO_IATA[raw];
    return mapped || upper.slice(0, 3);
  }
  function isKrJpRoute(origin, dest) {
    const o = normalizeIata(origin), d = normalizeIata(dest);
    return (KR_IATA.has(o) && JP_IATA.has(d)) || (JP_IATA.has(o) && KR_IATA.has(d));
  }
  function assertDate(label, value) {
    if (!DATE_RE.test(value)) throw new Error("Invalid " + label + " date");
  }
  function yymmdd(iso) { return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10); }
  function yyyymmdd(iso) { return iso.replace(/-/g, ""); }
  function clampAdults(n) {
    if (n == null || !Number.isFinite(n)) return 1;
    return Math.min(9, Math.max(1, Math.floor(n)));
  }
  function todayPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function buildGoogleFlightsUrl(input) {
    const origin = normalizeIata(input.origin);
    const dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const adults = clampAdults(input.adults);
    const oneWay = !input.returnDate;
    if (!oneWay) assertDate("return", input.returnDate);
    const datePart = oneWay ? "on " + input.outbound : "on " + input.outbound + " to " + input.returnDate;
    const oneWayPrefix = oneWay ? "one way " : "";
    const pax = adults > 1 ? " for " + adults + " adults" : "";
    const q = oneWayPrefix + "flights from " + origin + " to " + dest + " " + datePart + pax;
    const url = new URL("https://www.google.com/travel/flights");
    url.searchParams.set("q", q);
    url.searchParams.set("hl", "ko");
    url.searchParams.set("curr", "KRW");
    url.searchParams.set("gl", "KR");
    return url.toString();
  }
  function buildSkyscannerKrUrl(input) {
    const origin = normalizeIata(input.origin).toLowerCase();
    const dest = normalizeIata(input.dest).toLowerCase();
    assertDate("outbound", input.outbound);
    const adults = clampAdults(input.adults);
    const oneWay = !input.returnDate;
    if (!oneWay) assertDate("return", input.returnDate);
    const datePath = oneWay
      ? yymmdd(input.outbound) + "/"
      : yymmdd(input.outbound) + "/" + yymmdd(input.returnDate) + "/";
    const qs = new URLSearchParams({
      adultsv2: String(adults), cabinclass: "economy", currency: "KRW", locale: "ko-KR", market: "KR",
    });
    return "https://www.skyscanner.co.kr/transport/flights/" + origin + "/" + dest + "/" + datePath + "?" + qs;
  }
  function buildNaverFlightsUrl(input) {
    const origin = normalizeIata(input.origin);
    const dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const adults = clampAdults(input.adults);
    const oneWay = !input.returnDate;
    if (!oneWay) assertDate("return", input.returnDate);
    const out = yyyymmdd(input.outbound);
    const bothDomestic = KR_IATA.has(origin) && KR_IATA.has(dest);
    const scope = bothDomestic ? "domestic" : "international";
    let path;
    if (oneWay) path = origin + "-" + dest + "-" + out;
    else path = origin + "-" + dest + "-" + out + "/" + dest + "-" + origin + "-" + yyyymmdd(input.returnDate);
    const qs = new URLSearchParams({
      adult: String(adults), child: "0", infant: "0", fareType: bothDomestic ? "YC" : "Y",
    });
    return "https://flight.naver.com/flights/" + scope + "/" + path + "?" + qs;
  }
  function buildKayakUrl(input) {
    const origin = normalizeIata(input.origin);
    const dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const oneWay = !input.returnDate;
    if (!oneWay) assertDate("return", input.returnDate);
    const datePath = oneWay ? input.outbound : input.outbound + "/" + input.returnDate;
    return "https://www.kayak.co.kr/flights/" + origin + "-" + dest + "/" + datePath + "?sort=price_a";
  }
  function buildTwayUrl(input) {
    const origin = normalizeIata(input.origin), dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const oneWay = !input.returnDate;
    if (!oneWay) assertDate("return", input.returnDate);
    const url = new URL("https://www.twayair.com/app/booking/searchItinerary");
    url.searchParams.set("depAirportCode", origin);
    url.searchParams.set("arrAirportCode", dest);
    url.searchParams.set("tripType", oneWay ? "OW" : "RT");
    url.searchParams.set("bookingType", "I");
    url.searchParams.set("depDate", input.outbound.replace(/-/g, ""));
    if (!oneWay) url.searchParams.set("retDate", input.returnDate.replace(/-/g, ""));
    url.searchParams.set("adultCount", String(clampAdults(input.adults)));
    url.searchParams.set("childCount", "0");
    url.searchParams.set("infantCount", "0");
    url.searchParams.set("langCode", "ko-KR");
    return url.toString();
  }
  function buildAirBusanUrl(input) {
    const origin = normalizeIata(input.origin), dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const url = new URL("https://www.airbusan.com/content/common/booking/Availability");
    url.searchParams.set("depCity", origin);
    url.searchParams.set("arrCity", dest);
    url.searchParams.set("depDate", input.outbound.replace(/-/g, ""));
    if (input.returnDate) {
      assertDate("return", input.returnDate);
      url.searchParams.set("retDate", input.returnDate.replace(/-/g, ""));
      url.searchParams.set("tripType", "RT");
    } else url.searchParams.set("tripType", "OW");
    url.searchParams.set("adult", String(clampAdults(input.adults)));
    return url.toString();
  }
  function buildJinAirUrl(input) {
    const origin = normalizeIata(input.origin), dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const url = new URL("https://www.jinair.com/booking/index");
    url.searchParams.set("departure", origin);
    url.searchParams.set("arrival", dest);
    url.searchParams.set("depDate", input.outbound);
    if (input.returnDate) {
      assertDate("return", input.returnDate);
      url.searchParams.set("retDate", input.returnDate);
      url.searchParams.set("tripType", "RT");
    } else url.searchParams.set("tripType", "OW");
    url.searchParams.set("adult", String(clampAdults(input.adults)));
    return url.toString();
  }
  function buildJejuAirUrl(input) {
    const origin = normalizeIata(input.origin), dest = normalizeIata(input.dest);
    assertDate("outbound", input.outbound);
    const url = new URL("https://www.jejuair.net/ko/bookingAvailSearch.do");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", dest);
    url.searchParams.set("depDate", input.outbound.replace(/-/g, ""));
    if (input.returnDate) {
      assertDate("return", input.returnDate);
      url.searchParams.set("retDate", input.returnDate.replace(/-/g, ""));
      url.searchParams.set("tripType", "RT");
    } else url.searchParams.set("tripType", "OW");
    url.searchParams.set("adult", String(clampAdults(input.adults)));
    return url.toString();
  }

  const KR_JP_LCCS = [
    { id: "tway", label: "T'way Air", labelKo: "티웨이항공", build: buildTwayUrl,
      note: "날짜·인원이 폼에 미리 채워지지 않을 수 있음. 공식 사이트에서 재확인." },
    { id: "airbusan", label: "Air Busan", labelKo: "에어부산", build: buildAirBusanUrl,
      note: "검색 파라미터는 best-effort. 일정 선택 화면으로 이동하지 않으면 홈에서 재검색." },
    { id: "jinair", label: "Jin Air", labelKo: "진에어", build: buildJinAirUrl,
      note: "공식 예약 URL 스키마가 자주 바뀜. 실패 시 jinair.com에서 직접 검색." },
    { id: "jejuair", label: "Jeju Air", labelKo: "제주항공", build: buildJejuAirUrl,
      note: "딥링크는 참고용. 좌석·수하물 조건은 결제 전 항공사에서 확인." },
  ];

  function buildCompareLinks(input) {
    const origin = normalizeIata(input.origin);
    const dest = normalizeIata(input.dest);
    if (!IATA_RE.test(origin) || !IATA_RE.test(dest)) {
      throw new Error("Invalid IATA");
    }
    assertDate("outbound", input.outbound);
    if (input.returnDate) assertDate("return", input.returnDate);
    const links = [
      { id: "google", label: "Google Flights", labelKo: "구글 플라이트", url: buildGoogleFlightsUrl(input), kind: "meta" },
      { id: "skyscanner", label: "Skyscanner KR", labelKo: "스카이스캐너", url: buildSkyscannerKrUrl(input), kind: "meta" },
      { id: "naver", label: "Naver Flights", labelKo: "네이버 항공권", url: buildNaverFlightsUrl(input), kind: "ota",
        note: "카드 할인·프로모션 확인용. 국제선 path는 best-effort." },
      { id: "kayak", label: "Kayak KR", labelKo: "카약", url: buildKayakUrl(input), kind: "meta" },
    ];
    if (isKrJpRoute(origin, dest)) {
      for (const lcc of KR_JP_LCCS) {
        try {
          const url = lcc.build(Object.assign({}, input, { origin: origin, dest: dest }));
          if (url) links.push({ id: lcc.id, label: lcc.label, labelKo: lcc.labelKo, url: url, kind: "lcc", note: lcc.note });
        } catch (e) { /* skip */ }
      }
    }
    return links;
  }

  function formatWon(n) {
    return new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
  }

  function buildJudgment(prices) {
    const caveatsKo = [
      "수하물·좌석 지정 등 부가 요금은 비교에 포함되지 않았을 수 있습니다.",
      "OTA와 항공사 직판의 취소·변경 수수료가 다릅니다.",
      "광고의 「특가 from ₩X」는 왕복·성인 1명·특정 날짜가 아닐 수 있습니다.",
      "결제 전 반드시 항공사 공식 사이트에서 동일 요금을 확인하세요.",
    ];
    const checklistKo = [
      "구글/스카이스캐너에서 후보 운임·일정을 좁힌다.",
      "네이버 항공권에서 카드 할인·프로모션을 확인한다.",
      "동일·더 저렴하면 항공사 공식에서 결제한다 (KR↔JP는 LCC 공식도 대조).",
      "마일리지 사용 시 유류할증료·세금(awardCash)을 현금 총액과 함께 본다.",
    ];
    const entries = Object.entries(prices.cashBySource || {}).filter(function (e) {
      return typeof e[1] === "number" && Number.isFinite(e[1]) && e[1] > 0;
    });
    let cheapestCash =
      typeof prices.cheapestCash === "number" && Number.isFinite(prices.cheapestCash) && prices.cheapestCash > 0
        ? prices.cheapestCash : null;
    let cheapestSource = null;
    if (entries.length > 0) {
      entries.sort(function (a, b) { return a[1] - b[1]; });
      const src = entries[0][0], amount = entries[0][1];
      if (cheapestCash == null || amount < cheapestCash) {
        cheapestCash = amount; cheapestSource = src;
      } else if (cheapestCash != null) {
        const match = entries.find(function (e) { return e[1] === cheapestCash; });
        cheapestSource = (match && match[0]) || "입력한 최저 현금";
      }
    } else if (cheapestCash != null) {
      cheapestSource = "입력한 최저 현금";
    }
    const miles = typeof prices.miles === "number" && Number.isFinite(prices.miles) && prices.miles > 0 ? prices.miles : null;
    const awardCash = typeof prices.awardCash === "number" && Number.isFinite(prices.awardCash) && prices.awardCash >= 0 ? prices.awardCash : null;
    const threshold = prices.milesValueThreshold != null ? prices.milesValueThreshold : 3;
    const proseKo = [];
    if (cheapestCash == null) {
      proseKo.push("아직 현금 가격이 입력되지 않았습니다. 각 사이트에서 확인한 총액을 붙여 넣으면 현금 비교와 마일리지 손익을 문장으로 정리합니다.");
      proseKo.push("이 패널은 실시간 가격을 수집하지 않습니다. 직접 확인한 숫자만 사용하세요.");
      return { cheapestCash: null, cheapestSource: null, breakEvenWonPerMile: null, recommendation: "insufficient", proseKo: proseKo, checklistKo: checklistKo, caveatsKo: caveatsKo };
    }
    if (entries.length > 1) {
      proseKo.push("입력하신 출처별 현금 총액입니다.\n" + entries.map(function (e) { return "· " + e[0] + ": " + formatWon(e[1]); }).join("\n"));
    }
    proseKo.push("지금 기준 가장 낮은 현금 지출은 " + (cheapestSource ? cheapestSource + "의 " : "") + formatWon(cheapestCash) + "입니다.");
    let breakEvenWonPerMile = null;
    let recommendation = "cash";
    if (miles != null && awardCash != null) {
      const saved = cheapestCash - awardCash;
      breakEvenWonPerMile = saved / miles;
      proseKo.push("마일리지 사용 시 현금(세금·유류할증 등) " + formatWon(awardCash) + " + " + new Intl.NumberFormat("ko-KR").format(miles) + "마일이 필요합니다.");
      proseKo.push("손익분기 원/마일은 (최저현금 − 어워드현금) ÷ 마일 = (" + formatWon(cheapestCash) + " − " + formatWon(awardCash) + ") ÷ " + new Intl.NumberFormat("ko-KR").format(miles) + " ≈ " + breakEvenWonPerMile.toFixed(2) + "원/마일입니다.");
      if (saved <= 0) {
        recommendation = "cash";
        proseKo.push("어워드 현금만으로도 최저 현금 운임보다 비싸거나 같습니다. 마일리지를 쓰지 않는 편이 유리합니다.");
      } else if (breakEvenWonPerMile < threshold) {
        recommendation = "cash";
        proseKo.push("손익분기가 약 " + threshold + "원/마일보다 낮습니다. 짧은 일본 노선은 유류할증이 커서, 마일을 " + threshold + "원 이상으로 가치 있게 쓰는 경우 현금 LCC가 더 나을 때가 많습니다.");
      } else if (breakEvenWonPerMile < threshold + 1) {
        recommendation = "close";
        proseKo.push("손익분기가 " + threshold + "원/마일 근처입니다. 수하물·스케줄·취소 조건을 함께 보고 결정하세요.");
      } else {
        recommendation = "miles";
        proseKo.push("손익분기가 약 " + threshold + "원/마일보다 높습니다. 마일 가치가 " + threshold + "원 이하라고 본다면 마일리지가 현금보다 유리할 수 있습니다.");
      }
    } else if (miles != null || awardCash != null) {
      proseKo.push("마일리지 판단을 하려면 필요 마일(miles)과 어워드 현금(세금·할증)을 모두 입력하세요.");
    } else {
      proseKo.push("마일리지를 쓰지 않는다면, 위 최저 현금 후보를 네이버 카드 할인과 항공사 공식 요금과 한 번 더 대조하세요.");
    }
    return { cheapestCash: cheapestCash, cheapestSource: cheapestSource, breakEvenWonPerMile: breakEvenWonPerMile, recommendation: recommendation, proseKo: proseKo, checklistKo: checklistKo, caveatsKo: caveatsKo };
  }

  function parseMoney(raw) {
    const cleaned = String(raw || "").replace(/[,\s원₩]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function parseIntSafe(raw) {
    const cleaned = String(raw || "").replace(/[,\s]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }
  function verdictLabel(j) {
    switch (j.recommendation) {
      case "cash": return { text: "판단: 현금(LCC·OTA) 쪽이 유리해 보임", className: "verdict-cash" };
      case "miles": return { text: "판단: 마일리지가 유리해 보임", className: "verdict-miles" };
      case "close": return { text: "판단: 비슷함 — 부가조건으로 결정", className: "verdict-close" };
      default: return { text: "판단: 가격 입력 후 확인", className: "verdict-wait" };
    }
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // --- UI wiring ---
  const elOrigin = document.getElementById("ko-origin");
  const elDest = document.getElementById("ko-dest");
  const elOut = document.getElementById("ko-out");
  const elRet = document.getElementById("ko-ret");
  const elAdults = document.getElementById("ko-adults");
  const elLinks = document.getElementById("links-area");
  const elCashFields = document.getElementById("cash-fields");
  const elMiles = document.getElementById("ko-miles");
  const elAward = document.getElementById("ko-award-cash");
  const elJudge = document.getElementById("judgment-area");

  elOut.value = todayPlus(30);
  elRet.value = todayPlus(34);

  // cash fields
  let cheapestHtml = '<div class="field"><label for="ko-cheapest">최저 현금 (선택)</label><input id="ko-cheapest" inputmode="numeric" placeholder="예: 240000" /></div>';
  elCashFields.innerHTML = cheapestHtml + SOURCE_FIELDS.map(function (f) {
    return '<div class="field"><label for="ko-cash-' + f.id + '">' + escapeHtml(f.label) + '</label><input id="ko-cash-' + f.id + '" inputmode="numeric" placeholder="—" /></div>';
  }).join("");

  function render() {
    const outbound = elOut.value;
    const datesReady = DATE_RE.test(outbound);
    let links = [];
    if (datesReady) {
      try {
        links = buildCompareLinks({
          origin: normalizeIata(elOrigin.value) || elOrigin.value,
          dest: normalizeIata(elDest.value) || elDest.value,
          outbound: outbound,
          returnDate: elRet.value && DATE_RE.test(elRet.value) ? elRet.value : null,
          adults: Number(elAdults.value) || 1,
        });
      } catch (e) { links = []; }
    }
    if (!datesReady) {
      elLinks.innerHTML = '<p class="hint">가는 날을 선택하면 비교 링크가 생성됩니다.</p>';
    } else if (!links.length) {
      elLinks.innerHTML = '<p class="hint">출발·도착 IATA(또는 도시명)를 확인해 주세요.</p>';
    } else {
      elLinks.innerHTML = '<ul class="link-list">' + links.map(function (link) {
        return '<li class="link-item"><a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(link.labelKo) + ' <span class="badge ' + escapeHtml(link.kind) + '">' + escapeHtml(link.kind) + '</span></a>' +
          (link.note ? '<p class="note">' + escapeHtml(link.note) + '</p>' : '') + '</li>';
      }).join("") + '</ul>';
    }

    const cashBySource = {};
    SOURCE_FIELDS.forEach(function (f) {
      const inp = document.getElementById("ko-cash-" + f.id);
      const v = parseMoney(inp && inp.value);
      if (v != null) cashBySource[f.label] = v;
    });
    const cheapestEl = document.getElementById("ko-cheapest");
    const judgment = buildJudgment({
      cashBySource: cashBySource,
      cheapestCash: parseMoney(cheapestEl && cheapestEl.value),
      miles: parseIntSafe(elMiles.value),
      awardCash: parseMoney(elAward.value),
    });
    const verdict = verdictLabel(judgment);
    elJudge.innerHTML =
      '<span class="verdict ' + verdict.className + '">' + escapeHtml(verdict.text) + '</span>' +
      '<div class="prose">' + judgment.proseKo.map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join("") + '</div>' +
      '<h3 class="section-title">체크리스트</h3><ul class="list">' +
      judgment.checklistKo.map(function (i) { return '<li>' + escapeHtml(i) + '</li>'; }).join("") + '</ul>' +
      '<h3 class="section-title">주의</h3><ul class="list">' +
      judgment.caveatsKo.map(function (i) { return '<li>' + escapeHtml(i) + '</li>'; }).join("") + '</ul>';
  }

  ["input", "change"].forEach(function (evt) {
    document.getElementById("compare-panel").addEventListener(evt, render);
  });
  render();

  // expose for smoke tests
  window.FlightCompare = { buildCompareLinks: buildCompareLinks, buildJudgment: buildJudgment, normalizeIata: normalizeIata };
})();
