/* TezPost xarita yordamchisi (OpenStreetMap + Leaflet, kalit kerak emas) */
(function(){
  const CDN = ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/", "https://unpkg.com/leaflet@1.9.4/dist/"];
  let loading = null;
  function inject(base){
    return new Promise((res, rej)=>{
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "leaflet.css"; document.head.appendChild(l);
      const s = document.createElement("script"); s.src = base + "leaflet.js"; s.onload = ()=>window.L ? res() : rej(); s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function load(){
    if(window.L) return Promise.resolve();
    if(!loading) loading = inject(CDN[0]).catch(()=>inject(CDN[1])).catch(()=>{ loading = null; throw new Error("Xarita yuklanmadi. Internetni tekshiring"); });
    return loading;
  }
  const css = document.createElement("style");
  css.textContent = ".tzm{position:relative;width:100%;height:100%;background:#E6ECF5;border-radius:inherit;overflow:hidden;z-index:0}"
    + ".tzm .leaflet-container{width:100%;height:100%;font:inherit;background:#E6ECF5}"
    + ".tzpin{position:absolute;left:50%;top:50%;width:0;height:0;z-index:500;pointer-events:none}"
    + ".tzpin i{position:absolute;left:-15px;top:-46px;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#FF7A00;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.35);transition:transform .15s,top .15s}"
    + ".tzpin i::after{content:'';position:absolute;left:6px;top:6px;width:12px;height:12px;border-radius:50%;background:#fff}"
    + ".tzpin b{position:absolute;left:-6px;top:-3px;width:12px;height:6px;border-radius:50%;background:rgba(0,0,0,.3);transition:transform .15s}"
    + ".tzm.drag .tzpin i{top:-58px}.tzm.drag .tzpin b{transform:scale(.6)}"
    + ".tzpt{width:34px;height:34px;border-radius:50%;background:#0B4DB5;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:grid;place-items:center;color:#fff;font-size:16px}"
    + ".tzerr{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:20px;color:#6B7A99;font-size:14px}";
  document.head.appendChild(css);

  /* el ichida xarita yaratadi. opts: {lat,lng,zoom,pin:true,point:{lat,lng},onChange(lat,lng,byUser)} */
  async function create(el, opts){
    el.innerHTML = '<div class="tzerr">Xarita yuklanmoqda…</div>';
    try{ await load(); }catch(e){ el.innerHTML = '<div class="tzerr">' + e.message + '</div>'; throw e; }
    el.innerHTML = ""; el.classList.add("tzm");
    const box = document.createElement("div"); box.style.cssText = "width:100%;height:100%"; el.appendChild(box);
    const map = L.map(box, {zoomControl: true, attributionControl: true, tap: false}).setView([opts.lat, opts.lng], opts.zoom || 15);
    let fb = false, errs = 0;
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "© OpenStreetMap"}).addTo(map);
    osm.on("tileerror", ()=>{
      if(fb || ++errs < 4) return; fb = true; map.removeLayer(osm);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap © CARTO"}).addTo(map);
    });
    let line = null;
    if(opts.point){
      L.marker([opts.point.lat, opts.point.lng], {icon: L.divIcon({className: "", html: '<div class="tzpt">🏢</div>', iconSize: [34, 34], iconAnchor: [17, 17]}), interactive: false, keyboard: false}).addTo(map);
      line = L.polyline([[opts.point.lat, opts.point.lng], [opts.lat, opts.lng]], {color: "#0B4DB5", weight: 3, dashArray: "6 8", opacity: .7}).addTo(map);
    }
    if(opts.pin !== false){ const p = document.createElement("div"); p.className = "tzpin"; p.innerHTML = "<b></b><i></i>"; el.appendChild(p); }
    let user = false;
    map.on("dragstart zoomstart", ()=>{ user = true; el.classList.add("drag"); });
    map.on("moveend", ()=>{
      el.classList.remove("drag"); const c = map.getCenter();
      if(line) line.setLatLngs([[opts.point.lat, opts.point.lng], [c.lat, c.lng]]);
      const u = user; user = false; if(opts.onChange) opts.onChange(c.lat, c.lng, u);
    });
    setTimeout(()=>map.invalidateSize(), 120);
    return {
      map, center(){ const c = map.getCenter(); return {lat: c.lat, lng: c.lng}; },
      setView(lat, lng, z){ user = false; map.setView([lat, lng], z || map.getZoom()); },
      invalidate(){ map.invalidateSize(); }
    };
  }

  function short(a, full){
    if(!a) return full || "";
    const road = a.road || a.pedestrian || a.footway || a.residential || a.neighbourhood || "";
    const parts = [road && (road + (a.house_number ? " " + a.house_number : "")), a.suburb || a.neighbourhood || a.quarter || a.city_district, a.city || a.town || a.village || a.county].filter(Boolean);
    const seen = []; parts.forEach(p=>{ if(seen.indexOf(p) < 0) seen.push(p); });
    return seen.join(", ") || full || "";
  }
  async function reverse(lat, lng){
    const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=uz,ru&lat=" + lat + "&lon=" + lng);
    if(!r.ok) throw new Error("geocode"); const j = await r.json();
    return short(j.address, j.display_name);
  }
  async function search(q, near){
    let u = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=uz&accept-language=uz,ru&q=" + encodeURIComponent(q);
    if(near) u += "&viewbox=" + [near.lng - 0.6, near.lat + 0.5, near.lng + 0.6, near.lat - 0.5].join(",");
    const r = await fetch(u); if(!r.ok) throw new Error("search"); const j = await r.json();
    return j.map(x=>({lat: +x.lat, lng: +x.lon, name: short(x.address, x.display_name) || x.display_name, full: x.display_name}));
  }
  function locate(){
    return new Promise((res, rej)=>{
      if(!navigator.geolocation) return rej(new Error("Joylashuvni aniqlab bo'lmadi"));
      navigator.geolocation.getCurrentPosition(p=>res({lat: p.coords.latitude, lng: p.coords.longitude}),
        ()=>rej(new Error("Joylashuvga ruxsat bering yoki xaritadan tanlang")), {enableHighAccuracy: true, timeout: 12000, maximumAge: 30000});
    });
  }
  window.TZMap = {create, reverse, search, locate, load};
})();
