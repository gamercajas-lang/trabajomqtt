/**
 * ==========================================================================
 * GRAVITY — PANEL DE CONTROL IoT FUTURISTA (JAVASCRIPT NATIVO ES6+)
 * ==========================================================================
 * Desarrollado para la orquestación, observabilidad y telemetría en tiempo real
 * del Proyecto Botón. Separado modularmente, libre de frameworks.
 */

// Global state variables for tracking active states
let currentSlideIndex = 0;
let carouselIntervalId = null;
const carouselDelay = 4000; // 4 seconds auto-play
let chartsInitialized = false;

// Chart JS object references
let chartLineMqttInstance = null;
let chartDoughnutProtocolsInstance = null;
let chartBarErrorsInstance = null;
let chartAreaResourcesInstance = null;

// Mock database metrics for real-time fluctuation
let metricData = {
  devices: 24,
  mqttMsgs: 18430,
  httpRequests: 3124,
  alerts: 0,
  cpu: 42,
  ram: 68
};

// IoT Devices Active States
let deviceStates = {
  broker: true,
  gateway: true,
  sensors: true,
  actuators: true
};

// MQTT real client
let mqttClient = null;
let mqttSimStatus = 'disconnected'; // 'disconnected' | 'reconnecting' | 'connected'
let mqttReconnectTimeout = null;

// --------------------------------------------------------------------------
// 1. APP INITIALIZATION & DOM TRIGGERS
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initSPA();
  initClock();
  initHeroCarousel();
  initMetricsFluctuations();
  initTickerLoop();
  updateBulbWidget();
  
  // Set initial uptime state
  updateUptimeDisplay();
  setInterval(updateUptimeDisplay, 60000); // update uptime every minute
  
  console.log("%c[GRAVITY ENGINE] Sistema de monitoreo listo. Iniciando visualización...", "color: #00e5b0; font-weight: bold; font-size: 12px;");
});

// --------------------------------------------------------------------------
// 2. SPA NAVIGATION ROUTER
// --------------------------------------------------------------------------
function initSPA() {
  const navItems = document.querySelectorAll(".nav-item");
  const topbarTitle = document.getElementById("topbar-title");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // Remove active class from all items
      navItems.forEach(nav => nav.classList.remove("active"));
      
      // Add active to current item
      item.classList.add("active");
      
      // Get target section ID
      const targetId = item.getAttribute("data-target");
      const targetTitle = item.querySelector("span").textContent;
      
      // Hide all section panes
      const sections = document.querySelectorAll(".section-pane");
      sections.forEach(sec => sec.classList.remove("active"));
      
      // Show targeted pane
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
        
        // Dynamic title update in topbar
        topbarTitle.textContent = targetTitle;
        
        // Trigger lazy loading for Chart.js if entering Gráficos pane
        if (targetId === "sec-graficos") {
          lazyLoadCharts();
        }
      }
    });
  });
}

// --------------------------------------------------------------------------
// 3. TOPBAR CLOCK ENGINE
// --------------------------------------------------------------------------
function initClock() {
  const clockElement = document.getElementById("topbar-clock");
  
  function updateClock() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    
    // Add microsecond/tenths of second effect for futuristic feel
    const tenths = Math.floor(Math.random() * 10);
    
    clockElement.textContent = `${hrs}:${mins}:${secs}.${tenths}`;
  }
  
  // Update every 100ms for high-frequency millisecond counter effect
  setInterval(updateClock, 100);
}

// --------------------------------------------------------------------------
// 4. HERO CAROUSEL MODULE [A]
// --------------------------------------------------------------------------
function initHeroCarousel() {
  const carousel = document.getElementById("hero-carousel");
  const slides = carousel.querySelectorAll(".carousel-slide");
  const prevBtn = document.getElementById("carousel-prev-btn");
  const nextBtn = document.getElementById("carousel-next-btn");
  const counterElement = document.getElementById("carousel-counter");
  const dotsContainer = document.getElementById("carousel-dots-container");
  
  const totalSlides = slides.length;
  if (totalSlides === 0) return;

  // Generate Navigation Dots dynamically
  dotsContainer.innerHTML = "";
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement("span");
    dot.classList.add("carousel-dot");
    if (i === 0) dot.classList.add("active");
    dot.setAttribute("data-slide", i);
    dotsContainer.appendChild(dot);
    
    dot.addEventListener("click", () => {
      goToSlide(i);
      resetCarouselTimer();
    });
  }
  
  const dots = dotsContainer.querySelectorAll(".carousel-dot");

  function updateSlideUI() {
    slides.forEach((slide, index) => {
      if (index === currentSlideIndex) {
        slide.classList.add("active");
      } else {
        slide.classList.remove("active");
      }
    });

    dots.forEach((dot, index) => {
      if (index === currentSlideIndex) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    // Update Counter "1 / 4"
    counterElement.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
  }

  function goToSlide(index) {
    if (index >= totalSlides) {
      currentSlideIndex = 0;
    } else if (index < 0) {
      currentSlideIndex = totalSlides - 1;
    } else {
      currentSlideIndex = index;
    }
    updateSlideUI();
  }

  function nextSlide() {
    goToSlide(currentSlideIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentSlideIndex - 1);
  }

  // Set event listeners
  nextBtn.addEventListener("click", () => {
    nextSlide();
    resetCarouselTimer();
  });

  prevBtn.addEventListener("click", () => {
    prevSlide();
    resetCarouselTimer();
  });

  // Autoplay functionality
  function startCarouselTimer() {
    carouselIntervalId = setInterval(nextSlide, carouselDelay);
  }

  function resetCarouselTimer() {
    clearInterval(carouselIntervalId);
    startCarouselTimer();
  }

  // Hover pauses autoplay
  carousel.addEventListener("mouseenter", () => {
    clearInterval(carouselIntervalId);
  });

  carousel.addEventListener("mouseleave", () => {
    startCarouselTimer();
  });

  // Start initial timer
  startCarouselTimer();
  updateSlideUI();
}

// --------------------------------------------------------------------------
// 5. METRICS FLUCTUATION MODULE [B]
// --------------------------------------------------------------------------
function initMetricsFluctuations() {
  const devVal = document.getElementById("m-devices");
  const mqttVal = document.getElementById("m-mqtt");
  const httpVal = document.getElementById("m-http");
  const alertVal = document.getElementById("m-alerts");
  const cpuVal = document.getElementById("m-cpu");
  const ramVal = document.getElementById("m-ram");

  function updateMetricsInDOM() {
    // Active devices fluctuates if sensors reconnecting
    let activeSensors = 0;
    Object.values(deviceStates).forEach(state => {
      if (state) activeSensors++;
    });
    // Scale it to represents 24 overall nodos
    const currentActiveCount = Math.round(20 + activeSensors);
    devVal.textContent = currentActiveCount;
    
    // Accumulate total simulated MQTT msgs/h
    metricData.mqttMsgs += Math.round(Math.random() * 20 - 8);
    mqttVal.textContent = Number(metricData.mqttMsgs).toLocaleString();

    // Accumulate HTTP calls
    metricData.httpRequests += Math.round(Math.random() * 4 - 1);
    httpVal.textContent = Number(metricData.httpRequests).toLocaleString();

    // Alerts logic
    let alertCount = 0;
    if (!deviceStates.broker || !deviceStates.gateway) {
      alertCount = 2;
    } else if (!deviceStates.sensors || !deviceStates.actuators) {
      alertCount = 1;
    }
    alertVal.textContent = alertCount;
    const alertCard = alertVal.closest(".metric-card");
    const alertSub = alertCard.querySelector(".metric-subtext");
    if (alertCount > 0) {
      alertSub.innerHTML = `<i class="ti ti-alert-triangle"></i> Fallo crítico detectado`;
      alertSub.className = "metric-subtext font-mono text-pink";
      alertCard.style.borderColor = "var(--pink)";
    } else {
      alertSub.innerHTML = `<i class="ti ti-shield-check"></i> Sin anomalías críticas`;
      alertSub.className = "metric-subtext font-mono text-green";
      alertCard.style.borderColor = "var(--border-color-soft)";
    }

    // CPU load fluctuates
    metricData.cpu = Math.max(12, Math.min(95, metricData.cpu + Math.round(Math.random() * 10 - 5)));
    cpuVal.textContent = `${metricData.cpu}%`;

    // RAM fluctuates slowly
    metricData.ram = Math.max(50, Math.min(90, metricData.ram + Math.round(Math.random() * 4 - 2)));
    ramVal.textContent = `${metricData.ram}%`;

    // Sincronizar progress bars de Sección 3 Sistema
    const sysCpuBar = document.getElementById("bar-cpu");
    const sysCpuTxt = document.getElementById("bar-cpu-text");
    const sysRamBar = document.getElementById("bar-ram");
    const sysRamTxt = document.getElementById("bar-ram-text");

    if (sysCpuBar && sysCpuTxt) {
      sysCpuBar.style.width = `${metricData.cpu}%`;
      sysCpuTxt.textContent = `${metricData.cpu}%`;
    }
    if (sysRamBar && sysRamTxt) {
      sysRamBar.style.width = `${metricData.ram}%`;
      sysRamTxt.textContent = `${metricData.ram}%`;
    }
  }

  // Trigger metrics updates every 3 seconds
  setInterval(updateMetricsInDOM, 3000);
}

// --------------------------------------------------------------------------
// 6. TICKER INFINITE LOOP [C]
// --------------------------------------------------------------------------
function initTickerLoop() {
  const tickerTrack = document.getElementById("ticker-track");
  if (tickerTrack) {
    // Duplicate the ticker text content multiple times to ensure perfect loop
    const baseText = tickerTrack.innerHTML;
    tickerTrack.innerHTML = baseText.repeat(8);
  }
}

// --------------------------------------------------------------------------
// 7. IoT DEVICE SWITCHES & LIGHT BULB [D]
// --------------------------------------------------------------------------
// Master state for single button control
let masterState = false;

function toggleMaster() {
  masterState = !masterState;

  // Sync all device states to master state
  Object.keys(deviceStates).forEach(key => {
    deviceStates[key] = masterState;
  });

  const btn = document.getElementById('master-toggle-btn');
  const badge = document.getElementById('master-status-badge');

  const topic = 'gravity/actuators/cmd';
  const payloadStr = JSON.stringify({ cmd: masterState ? 'on' : 'off' });

  if (masterState) {
    btn.classList.add('master-btn-on');
    badge.textContent = 'ACTIVE';
    badge.className = 'status-badge font-mono state-on';
    showToast('RED ACTIVADA', topic, payloadStr, 'on');
    logMQTTConsole(`[MQTT PUBLISH] Red activada. Tópico: ${topic} | Payload: ${payloadStr}`, 'accent');
  } else {
    btn.classList.remove('master-btn-on');
    badge.textContent = 'INACTIVE';
    badge.className = 'status-badge font-mono state-off';
    showToast('RED APAGADA', topic, payloadStr, 'off');
    logMQTTConsole(`[MQTT PUBLISH] Red apagada. Tópico: ${topic} | Payload: ${payloadStr}`, 'pink');
  }

  // Publicar al broker real si está conectado
  if (mqttClient && mqttSimStatus === 'connected') {
    mqttClient.publish(topic, payloadStr, { qos: 1 }, (err) => {
      if (err) logMQTTConsole(`[MQTT ERROR] Fallo al publicar comando maestro: ${err.message}`, 'pink');
    });
  }

  insertEventTableRow('MASTER_CTRL', topic, masterState ? 'Comando ON ejecutado' : 'Comando OFF ejecutado', masterState ? 'SUCCESS' : 'DANGER');
  updateBulbWidget();
}

function toggleDevice(deviceName) {
  // Toggle the internal state
  deviceStates[deviceName] = !deviceStates[deviceName];
  
  const card = document.querySelector(`.controller-card[data-device="${deviceName}"]`);
  if (!card) return;

  const btn = card.querySelector(".toggle-btn");
  const badge = card.querySelector(".status-badge");
  const topic = card.querySelector(".topic-tag").textContent;
  
  let payloadStr = "";
  
  if (deviceStates[deviceName]) {
    btn.classList.add("btn-on");
    badge.textContent = "ACTIVE";
    badge.className = "status-badge font-mono state-on";
    payloadStr = JSON.stringify({ cmd: "on" });
    showToast(`${deviceName.toUpperCase()} HABILITADO`, topic, payloadStr, "on");
    logMQTTConsole(`[MQTT PUBLISH] Canal de telemetría abierto. Tópico: ${topic} | Payload: ${payloadStr}`, "accent");
  } else {
    btn.classList.remove("btn-on");
    badge.textContent = "INACTIVE";
    badge.className = "status-badge font-mono state-off";
    payloadStr = JSON.stringify({ cmd: "off" });
    showToast(`${deviceName.toUpperCase()} APAGADO`, topic, payloadStr, "off");
    logMQTTConsole(`[MQTT PUBLISH] Canal de telemetría suspendido. Tópico: ${topic} | Payload: ${payloadStr}`, "pink");
  }
  
  insertEventTableRow(deviceName.toUpperCase(), topic, deviceStates[deviceName] ? "Comando ON ejecutado" : "Comando OFF ejecutado", deviceStates[deviceName] ? "SUCCESS" : "DANGER");
  updateBulbWidget();
}

// Estado de cada canal RGB
const rgbStates = { red: false, green: false, blue: false };

function toggleRGB(color) {
  rgbStates[color] = !rgbStates[color];
  const isOn = rgbStates[color];

  const orb   = document.getElementById(`orb-${color}`);
  const badge = document.getElementById(`badge-${color}`);
  const btn   = document.getElementById(`btn-${color}`);
  const card  = document.getElementById(`card-led-${color}`);

  const topicMap = {
    red:   'nanoesp32/led/red',
    green: 'nanoesp32/led/green',
    blue:  'nanoesp32/led/blue'
  };
  const topic = topicMap[color];
  const payload = isOn ? 'on' : 'off';

  if (isOn) {
    orb.classList.add('active');
    btn.classList.add('master-btn-on');
    badge.textContent = 'ON';
    badge.className = 'status-badge font-mono state-on';
    card.classList.add(`active-${color}`);
    logMQTTConsole(`[MQTT PUBLISH] LED ${color.toUpperCase()} encendido. Tópico: ${topic} | Payload: ${payload}`, 'accent');
    showToast(`LED ${color.toUpperCase()} ON`, topic, payload, 'on');
  } else {
    orb.classList.remove('active');
    btn.classList.remove('master-btn-on');
    badge.textContent = 'OFF';
    badge.className = 'status-badge font-mono state-off';
    card.classList.remove(`active-${color}`);
    logMQTTConsole(`[MQTT PUBLISH] LED ${color.toUpperCase()} apagado. Tópico: ${topic} | Payload: ${payload}`, 'pink');
    showToast(`LED ${color.toUpperCase()} OFF`, topic, payload, 'off');
  }

  // Publicar al broker real si está conectado
  if (mqttClient && mqttSimStatus === 'connected') {
    mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) logMQTTConsole(`[MQTT ERROR] Fallo al publicar LED ${color}: ${err.message}`, 'pink');
    });
  }

  insertEventTableRow(`LED_${color.toUpperCase()}`, topic, isOn ? 'Comando ON ejecutado' : 'Comando OFF ejecutado', isOn ? 'SUCCESS' : 'DANGER');
}

function updateBulbWidget() {
  // La bombilla fue reemplazada por el control RGB. Función vacía para compatibilidad.
}

// --------------------------------------------------------------------------
// 8. LOG ENGINE FOR SYSTEM EVENTS TABLE
// --------------------------------------------------------------------------
function insertEventTableRow(deviceName, topic, eventMsg, state) {
  const tbody = document.getElementById("events-table-body");
  if (!tbody) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const tr = document.createElement("tr");
  
  let badgeClass = "badge-accent";
  if (state === "DANGER") badgeClass = "badge-pink";
  if (state === "WARNING") badgeClass = "badge-warning";
  if (state === "INFO") badgeClass = "badge-cyan";

  tr.innerHTML = `
    <td>${timeStr}</td>
    <td><span class="device-cell"><i class="ti ti-toggle-right"></i> ${deviceName}_CTRL</span></td>
    <td>${topic}</td>
    <td>${eventMsg}</td>
    <td><span class="badge ${badgeClass}">${state}</span></td>
  `;

  // Prepend to top of table
  tbody.insertBefore(tr, tbody.firstChild);

  // Maintain only 5 rows in the table
  if (tbody.children.length > 5) {
    tbody.removeChild(tbody.lastChild);
  }
}

// --------------------------------------------------------------------------
// 9. LAZY LOAD CHARTS CONFIG (Chart.js v4)
// --------------------------------------------------------------------------
function lazyLoadCharts() {
  if (chartsInitialized) return;
  
  console.log("%c[GRAVITY ANALYTICS] Inicializando librerías Chart.js...", "color: #00bfff; font-weight: bold;");

  // General grid styling for dark theme
  const chartGridColor = "rgba(255, 255, 255, 0.05)";
  const chartTicksColor = "#6b7fa3";
  const fontFamilyJetBrains = "'JetBrains Mono', monospace";
  
  // Custom dark chart theme settings
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // We use custom HTML legends
      },
      tooltip: {
        backgroundColor: "rgba(8, 12, 18, 0.9)",
        titleFont: { family: fontFamilyJetBrains, size: 12 },
        bodyFont: { family: fontFamilyJetBrains, size: 11 },
        borderColor: "rgba(0, 229, 176, 0.2)",
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        cornerRadius: 6
      }
    },
    scales: {
      x: {
        grid: {
          color: chartGridColor,
          drawBorder: false
        },
        ticks: {
          color: chartTicksColor,
          font: { family: fontFamilyJetBrains, size: 9 }
        }
      },
      y: {
        grid: {
          color: chartGridColor,
          drawBorder: false
        },
        ticks: {
          color: chartTicksColor,
          font: { family: fontFamilyJetBrains, size: 9 }
        }
      }
    }
  };

  // Chart 1: Line Chart (MQTT Messages per hour)
  const ctxLine = document.getElementById("chart-line-mqtt").getContext("2d");
  chartLineMqttInstance = new Chart(ctxLine, {
    type: "line",
    data: {
      labels: ["02:00", "03:00", "04:00", "05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00"],
      datasets: [{
        label: "Mensajes MQTT",
        data: [12400, 14200, 13100, 15600, 16800, 18900, 17200, 19100, 18400, 21200, 19430, 22300],
        borderColor: "#00e5b0",
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, "rgba(0, 229, 176, 0.2)");
          gradient.addColorStop(1, "rgba(0, 229, 176, 0.0)");
          return gradient;
        },
        pointBackgroundColor: "#00e5b0",
        pointBorderColor: "#080c12",
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    },
    options: commonOptions
  });

  // Chart 2: Doughnut Chart (IoT Protocols Distribution)
  const ctxDoughnut = document.getElementById("chart-doughnut-protocols").getContext("2d");
  const protocolData = [45, 25, 20, 10]; // percentages
  const protocolLabels = ["MQTT", "HTTP", "WebSocket", "CoAP"];
  const protocolColors = ["#00e5b0", "#00bfff", "#7c5cfc", "#f5a623"];

  chartDoughnutProtocolsInstance = new Chart(ctxDoughnut, {
    type: "doughnut",
    data: {
      labels: protocolLabels,
      datasets: [{
        data: protocolData,
        backgroundColor: protocolColors,
        borderWidth: 3,
        borderColor: "#0a1017",
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(8, 12, 18, 0.9)",
          bodyFont: { family: fontFamilyJetBrains, size: 11 },
          borderColor: "rgba(255, 255, 255, 0.05)",
          borderWidth: 1,
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${context.raw}%`;
            }
          }
        }
      }
    }
  });

  // Generate Custom HTML Legend for Doughnut
  const legendContainer = document.getElementById("doughnut-legend");
  if (legendContainer) {
    legendContainer.innerHTML = "";
    protocolLabels.forEach((label, i) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <div class="legend-label-box">
          <span class="legend-dot" style="background-color: ${protocolColors[i]}"></span>
          <span>${label}</span>
        </div>
        <span class="legend-val">${protocolData[i]}%</span>
      `;
      legendContainer.appendChild(item);
    });
  }

  // Chart 3: Bar Chart (Errors by component)
  const ctxBar = document.getElementById("chart-bar-errors").getContext("2d");
  chartBarErrorsInstance = new Chart(ctxBar, {
    type: "bar",
    data: {
      labels: ["Broker", "Gateway", "Sensores", "Relés", "API Cloud"],
      datasets: [{
        label: "Errores",
        data: [12, 45, 18, 5, 28],
        backgroundColor: ["#7c5cfc", "#ff4d6d", "#f5a623", "#00bfff", "#00e5b0"],
        borderRadius: 4,
        barPercentage: 0.55
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        x: {
          grid: { display: false }, // no vertical gridlines
          ticks: { color: chartTicksColor, font: { family: fontFamilyJetBrains, size: 9 } }
        },
        y: {
          grid: { color: chartGridColor, drawBorder: false },
          ticks: { color: chartTicksColor, font: { family: fontFamilyJetBrains, size: 9 } }
        }
      }
    }
  });

  // Chart 4: Double Area Chart (CPU vs RAM usage over 7 days)
  const ctxArea = document.getElementById("chart-area-resources").getContext("2d");
  chartAreaResourcesInstance = new Chart(ctxArea, {
    type: "line",
    data: {
      labels: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
      datasets: [
        {
          label: "Uso CPU (%)",
          data: [42, 58, 65, 48, 52, 38, 44],
          borderColor: "#00bfff",
          borderWidth: 2,
          fill: true,
          backgroundColor: "rgba(0, 191, 255, 0.06)",
          pointBackgroundColor: "#00bfff",
          pointHoverRadius: 5
        },
        {
          label: "Uso RAM (%)",
          data: [68, 70, 72, 69, 74, 65, 68],
          borderColor: "#00e5b0",
          borderWidth: 2,
          borderDash: [5, 5], // dashed RAM
          fill: true,
          backgroundColor: "rgba(0, 229, 176, 0.03)",
          pointBackgroundColor: "#00e5b0",
          pointHoverRadius: 5
        }
      ]
    },
    options: commonOptions
  });

  chartsInitialized = true;
}

// --------------------------------------------------------------------------
// 10. SYSTEM UPTIME METRIC INCREMENTER
// --------------------------------------------------------------------------
function updateUptimeDisplay() {
  const uptimeTxt = document.getElementById("sys-uptime");
  if (!uptimeTxt) return;

  // Real mock time calculator starting from a baseline
  const startUptime = new Date("2026-05-08T00:00:00");
  const now = new Date();
  
  const diffMs = now - startUptime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  uptimeTxt.textContent = `${diffDays} días, ${diffHrs} horas, ${diffMins} minutos`;
}

// --------------------------------------------------------------------------
// 11. IoT CONNECTIONS SWITCHER
// --------------------------------------------------------------------------
function switchProtocolView() {
  const selector = document.getElementById("connection-protocol-selector");
  const selectionVal = selector.value;
  
  // Hide all panels
  const panels = document.querySelectorAll(".protocol-panel");
  panels.forEach(p => p.classList.remove("active"));
  
  // Show specific panel
  let targetPanel = null;
  if (selectionVal === "MQTT") targetPanel = document.getElementById("panel-protocol-mqtt");
  if (selectionVal === "HTTP") targetPanel = document.getElementById("panel-protocol-http");
  if (selectionVal === "WS") targetPanel = document.getElementById("panel-protocol-ws");
  if (selectionVal === "COAP") targetPanel = document.getElementById("panel-protocol-coap");

  if (targetPanel) {
    targetPanel.classList.add("active");
  }
}

// --------------------------------------------------------------------------
// 12. MQTT broker SIMULATOR CONTROL & CYBERPUNK TERMINAL
// --------------------------------------------------------------------------
function logMQTTConsole(message, type = "muted") {
  const terminal = document.getElementById("mqtt-terminal-logs");
  if (!terminal) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + "." + String(now.getMilliseconds()).padStart(3, '0');

  const line = document.createElement("div");
  line.className = `log-line text-${type}`;
  line.innerHTML = `<span class="text-muted">[${timeStr}]</span> ${message}`;

  terminal.appendChild(line);
  
  // Auto-scroll to bottom of terminal
  terminal.scrollTop = terminal.scrollHeight;
}

function clearConsole() {
  const terminal = document.getElementById("mqtt-terminal-logs");
  if (!terminal) return;
  terminal.innerHTML = `<div class="log-line text-muted">[SYSTEM INFO] Consola limpiada por el operario. Buffer restablecido.</div>`;
}

function actionMqttConnect() {
  if (mqttSimStatus !== 'disconnected') return;

  const host = document.getElementById("mqtt-host").value || "broker.hivemq.com";
  const port = document.getElementById("mqtt-port").value || "8884";
  const clientId = document.getElementById("mqtt-client-id").value || ("gravity_" + Math.random().toString(16).slice(2, 8));

  mqttSimStatus = 'reconnecting';
  updateMqttControlsUI();

  // Usar WSS (WebSocket seguro) para broker.hivemq.com puerto 8884
  // Usar WS (sin TLS) para brokers locales como Mosquitto en puerto 9001
  const useSecure = (host.includes("hivemq.com") || port === "8884" || port === "8883");
  const protocol = useSecure ? "wss" : "ws";
  const connectionUrl = `${protocol}://${host}:${port}/mqtt`;

  logMQTTConsole(`[MQTT CONNECT] Conectando a: ${connectionUrl}...`, "warning");
  logMQTTConsole(`[MQTT CONNECT] ClientID: ${clientId}`, "muted");

  const options = {
    clientId: clientId,
    keepalive: 60,
    reconnectPeriod: 0,     // sin auto-reconexión, la manejamos manualmente
    connectTimeout: 10000,
    clean: true,
  };

  // Añadir usuario/contraseña si los campos existen y tienen valor
  const userField = document.getElementById("mqtt-username");
  const passField = document.getElementById("mqtt-password");
  if (userField && userField.value) options.username = userField.value;
  if (passField && passField.value) options.password = passField.value;

  try {
    mqttClient = mqtt.connect(connectionUrl, options);
  } catch (e) {
    mqttSimStatus = 'disconnected';
    updateMqttControlsUI();
    logMQTTConsole(`[MQTT ERROR] No se pudo iniciar cliente: ${e.message}`, "pink");
    return;
  }

  mqttClient.on('connect', () => {
    mqttSimStatus = 'connected';
    updateMqttControlsUI();

    logMQTTConsole(`[MQTT SUCCESS] Conexión establecida con el broker.`, "accent");
    logMQTTConsole(`[MQTT SUBSCRIBE] Suscrito a: gravity/#`, "cyan");

    // Suscribirse al tópico de comandos para recibir mensajes del Arduino
    mqttClient.subscribe('gravity/#', { qos: 1 }, (err) => {
      if (err) {
        logMQTTConsole(`[MQTT ERROR] Fallo al suscribir: ${err.message}`, "pink");
      }
    });

    showToast("MQTT CONECTADO", `${host}:${port}`, "Status: SUCCESS", "on");
  });

  mqttClient.on('message', (topic, message) => {
    const payload = message.toString();
    logMQTTConsole(`[MQTT RECIBIDO] Tópico: ${topic} | Payload: ${payload}`, "cyan");

    // Reaccionar a comandos ON/OFF por color RGB (payload plano: "on" / "off")
    ['red', 'green', 'blue'].forEach(color => {
      if (topic === `nanoesp32/led/${color}`) {
        if (payload === 'on'  && !rgbStates[color]) toggleRGB(color);
        if (payload === 'off' &&  rgbStates[color]) toggleRGB(color);
      }
    });
  });

  mqttClient.on('error', (err) => {
    logMQTTConsole(`[MQTT ERROR] ${err.message}`, "pink");
    showToast("ERROR MQTT", host, err.message, "off");
    mqttSimStatus = 'disconnected';
    updateMqttControlsUI();
  });

  mqttClient.on('close', () => {
    if (mqttSimStatus !== 'disconnected') {
      mqttSimStatus = 'disconnected';
      updateMqttControlsUI();
      logMQTTConsole(`[MQTT CLOSE] Conexión cerrada con el broker.`, "pink");
    }
  });
}

function actionMqttDisconnect() {
  if (mqttSimStatus === 'disconnected') return;

  if (mqttClient) {
    mqttClient.end(true); // forzar cierre limpio
    mqttClient = null;
  }

  clearTimeout(mqttReconnectTimeout);
  mqttSimStatus = 'disconnected';
  updateMqttControlsUI();

  logMQTTConsole(`[MQTT SHUTDOWN] Conexión cerrada intencionalmente por directiva local.`, "pink");
  showToast("MQTT DESCONECTADO", "gravity/devices/telemetry", "Status: SHUTDOWN", "off");
}

function actionMqttPublish() {
  const topic = document.getElementById("mqtt-topic").value || "gravity/devices/telemetry";
  const qos = parseInt(document.getElementById("mqtt-qos").value) || 1;

  const mockPayload = {
    client_id: document.getElementById("mqtt-client-id").value || "gravity_client",
    uptime_sec: Math.floor(performance.now() / 1000),
    cpu_percent: metricData.cpu,
    ram_percent: metricData.ram,
    network_latency: "12ms",
    status: "OK"
  };

  const payloadStr = JSON.stringify(mockPayload);

  if (mqttSimStatus !== 'connected' || !mqttClient) {
    logMQTTConsole(`[MQTT ERROR] No se puede publicar. Broker desconectado.`, "pink");
    showToast("ERROR DE PUBLICACIÓN", topic, "Código: Broker desconectado", "off");
    return;
  }

  mqttClient.publish(topic, payloadStr, { qos: qos }, (err) => {
    if (err) {
      logMQTTConsole(`[MQTT ERROR] Fallo al publicar: ${err.message}`, "pink");
    } else {
      logMQTTConsole(`[MQTT PUBLISH] Mensaje publicado. Tópico: ${topic} | QoS: ${qos}`, "cyan");
      logMQTTConsole(`[MQTT PAYLOAD] Contenido: ${payloadStr}`, "muted");
      showToast("PAYLOAD PUBLICADO", topic, `QoS ${qos} | Uptime: ${mockPayload.uptime_sec}s`, "on");
    }
  });
}

function updateMqttControlsUI() {
  const btnConnect = document.getElementById("mqtt-btn-connect");
  const btnDisconnect = document.getElementById("mqtt-btn-disconnect");
  const btnPublish = document.getElementById("mqtt-btn-publish");
  const statusBadge = document.getElementById("mqtt-status-badge");
  const pulseDot = document.getElementById("mqtt-status-pulse");

  if (mqttSimStatus === 'connected') {
    btnConnect.disabled = true;
    btnConnect.classList.add("disabled");

    btnDisconnect.disabled = false;
    btnDisconnect.classList.remove("disabled");

    btnPublish.disabled = false;
    btnPublish.classList.remove("disabled");

    statusBadge.className = "badge-status connected";
    statusBadge.innerHTML = `<span class="pulse-dot green animate-pulse" id="mqtt-status-pulse"></span> CONECTADO`;
  } else if (mqttSimStatus === 'reconnecting') {
    btnConnect.disabled = true;
    btnConnect.classList.add("disabled");

    btnDisconnect.disabled = true;
    btnDisconnect.classList.add("disabled");

    btnPublish.disabled = true;
    btnPublish.classList.add("disabled");

    statusBadge.className = "badge-status reconnecting";
    statusBadge.innerHTML = `<span class="pulse-dot warning animate-pulse" id="mqtt-status-pulse"></span> RECONECTANDO`;
  } else {
    // Disconnected
    btnConnect.disabled = false;
    btnConnect.classList.remove("disabled");

    btnDisconnect.disabled = true;
    btnDisconnect.classList.add("disabled");

    btnPublish.disabled = true; // allow publish simulation but with error
    btnPublish.classList.remove("disabled");

    statusBadge.className = "badge-status disconnected";
    statusBadge.innerHTML = `<span class="pulse-dot red animate-pulse" id="mqtt-status-pulse"></span> DESCONECTADO`;
  }
}

// --------------------------------------------------------------------------
// 13. BOTTOM-RIGHT TOAST NOTIFICATION FRAMEWORK
// --------------------------------------------------------------------------
function showToast(title, topic, payload, type = "on") {
  const holder = document.getElementById("toast-holder");
  if (!holder) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === "on" ? "toast-on" : "toast-off"}`;

  const iconName = type === "on" ? "ti-circle-check" : "ti-alert-circle";
  
  toast.innerHTML = `
    <i class="ti ${iconName} toast-icon"></i>
    <div class="toast-content">
      <span class="toast-title">${title}</span>
      <span class="toast-meta-line font-mono">Topic: ${topic}</span>
      <span class="toast-payload font-mono">${payload}</span>
    </div>
    <div class="toast-progress-bar"></div>
  `;

  holder.appendChild(toast);

  // Trigger linear progress bar shrinkage
  const progressBar = toast.querySelector(".toast-progress-bar");
  progressBar.style.transition = "transform 3.5s linear";
  progressBar.style.transform = "scaleX(1)";
  
  // Set scale to 0 immediately inside microtask/animation frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progressBar.style.transform = "scaleX(0)";
    });
  });

  // Auto-remove toast after 3.5s
  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 3500);
}

// --------------------------------------------------------------------------
// 14. COMPATIBILIDAD CON MQTT REAL (Comentarios aclaratorios estructurados)
// --------------------------------------------------------------------------
/**
 * ==========================================================================
 * GUÍA DE INTEGRACIÓN MQTT REAL (HIVE MQ, EMQX, MOSQUITTO)
 * ==========================================================================
 * Para establecer una conexión de red activa real en producción:
 * 
 * 1. IMPORTAR LA LIBRERÍA MQTT.JS DESDE CDN:
 *    Añadir el siguiente tag <script> en index.html antes de cargar app.js:
 *    <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
 * 
 * 2. CÓDIGO DE CONEXIÓN REAL (Implementar en actionMqttConnect):
 *    ```javascript
 *    // Reemplazar la simulación por la llamada al cliente real:
 *    const options = {
 *        clientId: clientId,
 *        username: usernameVal || undefined,
 *        password: passwordVal || undefined,
 *        keepalive: 60,
 *        reconnectPeriod: 5000,
 *        connectTimeout: 30 * 1000,
 *        clean: true
 *    };
 * 
 *    // ws:// o wss:// para Websockets en el cliente web
 *    const connectionUrl = `ws://${host}:${port}/mqtt`;
 * 
 *    const realMqttClient = mqtt.connect(connectionUrl, options);
 * 
 *    // Hook de conexión exitosa
 *    realMqttClient.on('connect', () => {
 *        console.log("MQTT Real Conectado!");
 *        // Realizar subscribe
 *        realMqttClient.subscribe('gravity/#', { qos: 1 }, (err) => {
 *            if (!err) {
 *                console.log("Subscrito con éxito");
 *            }
 *        });
 *    });
 *    ```
 * 
 * 3. CONTROL DE MENSAJES RECIBIDOS (Subscription listener):
 *    ```javascript
 *    realMqttClient.on('message', (topic, message) => {
 *        const payload = message.toString();
 *        console.log(`Recibido en tópico ${topic}: ${payload}`);
 *        
 *        // Registrar en terminal visual
 *        logMQTTConsole(`[REAL MQTT MSG] Tópico: ${topic} | Datos: ${payload}`, "cyan");
 *        
 *        // Si el payload es de control, gatillar cambios de relés en vivo:
 *        if (topic === 'gravity/actuators/cmd') {
 *             const data = JSON.parse(payload);
 *             if (data.cmd === 'on') {
 *                  // encender bombillo
 *             }
 *        }
 *    });
 *    ```
 * 
 * 4. PUBLICAR MENSAJES REALES (Publish trigger):
 *    ```javascript
 *    function publishRealMessage(topic, payloadObj, qosVal) {
 *        if (realMqttClient && realMqttClient.connected) {
 *             realMqttClient.publish(topic, JSON.stringify(payloadObj), { qos: qosVal }, (err) => {
 *                 if (!err) {
 *                      console.log("Mensaje publicado en broker");
 *                 }
 *             });
 *        }
 *    }
 *    ```
 */
