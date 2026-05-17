document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let prayerTimesData = null;
let currentPrayerIndex = -1;
let countdownInterval = null;
let prayerSettings = JSON.parse(localStorage.getItem('prayerSettings')) || { 
    Fajr: true, Sunrise: false, Dhuhr: true, Asr: true, Sunset: false, Maghrib: true, Isha: true 
};

let appConfig = JSON.parse(localStorage.getItem('appConfig')) || {
    jurisprudence: 'standard',
    manualAdjustments: { Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Sunset: 0, Maghrib: 0, Isha: 0 },
    theme: 'dark'
};

// Instantly apply theme to body to avoid page flash
if (appConfig.theme === 'light') {
    document.body.classList.add('light-theme');
}

const PRAYERS = [
    { id: 'Fajr', name: 'Fajr', icon: 'fa-cloud-moon' },
    { id: 'Sunrise', name: 'Sunrise', icon: 'fa-sun' },
    { id: 'Dhuhr', name: 'Dhuhr', icon: 'fa-sun' },
    { id: 'Asr', name: 'Asr', icon: 'fa-cloud-sun' },
    { id: 'Sunset', name: 'Sunset', icon: 'fa-cloud-sun' },
    { id: 'Maghrib', name: 'Maghrib', icon: 'fa-moon' },
    { id: 'Isha', name: 'Isha', icon: 'fa-star' }
];

async function fetchIpLocation() {
    // Try ipapi.co first
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
            return {
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                city: data.city || data.region || 'Local Area'
            };
        }
    } catch (e) {
        console.log("ipapi.co failed, trying secondary...");
    }
    
    // Try ipwho.is as backup
    try {
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();
        if (data.success && data.latitude && data.longitude) {
            return {
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                city: data.city || data.region || 'Local Area'
            };
        }
    } catch (e) {
        console.log("ipwho.is failed");
    }
    return null;
}

async function loadAppData(latitude, longitude, customCity = null) {
    window.currentLat = latitude;
    window.currentLon = longitude;
    
    if (customCity) {
        document.getElementById('location-name').textContent = customCity;
        initTasbeeh(customCity);
    } else {
        await fetchLocationName(latitude, longitude);
    }
    await fetchWeather(latitude, longitude);
    await fetchPrayerTimes(latitude, longitude);
    await fetchQibla(latitude, longitude);
    await fetchCalendar(latitude, longitude);
    
    // Setup compass listeners
    registerCompassListener();
    
    const enableBtn = document.getElementById('enable-compass-btn');
    if (enableBtn) {
        // Clear previous listeners to avoid duplicates
        enableBtn.replaceWith(enableBtn.cloneNode(true));
        document.getElementById('enable-compass-btn').addEventListener('click', requestCompassPermission);
    }
}

function adjustTimeString(timeStr, offsetMinutes) {
    if (!offsetMinutes) return timeStr;
    const match = timeStr.match(/^(\d{2}):(\d{2})/);
    if (!match) return timeStr;
    
    let hours = parseInt(match[1]);
    let minutes = parseInt(match[2]);
    
    let date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes + offsetMinutes);
    
    const newHours = date.getHours().toString().padStart(2, '0');
    const newMinutes = date.getMinutes().toString().padStart(2, '0');
    
    const suffix = timeStr.substring(5);
    return `${newHours}:${newMinutes}${suffix}`;
}

function applyManualAdjustments() {
    if (!prayerTimesData) return;
    PRAYERS.forEach(prayer => {
        const offset = parseInt(appConfig.manualAdjustments[prayer.id]) || 0;
        if (offset !== 0 && prayerTimesData[prayer.id]) {
            prayerTimesData[prayer.id] = adjustTimeString(prayerTimesData[prayer.id], offset);
        }
    });
}

async function handleLocationFallback() {
    document.getElementById('location-name').textContent = "Locating via IP...";
    const ipLoc = await fetchIpLocation();
    if (ipLoc) {
        await loadAppData(ipLoc.latitude, ipLoc.longitude, ipLoc.city);
    } else {
        // Ultimate fallback to Mecca
        document.getElementById('location-name').textContent = "Mecca (Default)";
        initTasbeeh("Mecca");
        
        window.currentLat = 21.4225;
        window.currentLon = 39.8262;
        
        await fetchWeather(21.4225, 39.8262);
        await fetchPrayerTimes(21.4225, 39.8262);
        await fetchQibla(21.4225, 39.8262);
        await fetchCalendar(21.4225, 39.8262);
    }
}

async function initApp() {
    updateDateDisplay();
    fetchAyatOfTheDay();
    fetchHadithOfTheDay();
    
    // Geolocation requires a Secure Context (HTTPS or localhost).
    // On insecure HTTP contexts (like local network IP on phones), we bypass it immediately.
    const isSecure = window.isSecureContext || (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    if (isSecure && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await loadAppData(latitude, longitude);
            },
            async (error) => {
                console.warn("Browser Geolocation blocked/failed:", error);
                await handleLocationFallback();
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        console.log("Insecure context or Geolocation unsupported. Triggering IP fallback directly.");
        await handleLocationFallback();
    }
}

function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', options);
}

async function fetchWeather(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        let icon = '☀️';
        const code = data.current_weather.weathercode;
        if (code >= 1 && code <= 3) icon = '⛅';
        if (code >= 45 && code <= 48) icon = '🌫️';
        if (code >= 51 && code <= 67) icon = '🌧️';
        if (code >= 71 && code <= 77) icon = '❄️';
        if (code >= 80 && code <= 82) icon = '🌧️';
        if (code >= 95 && code <= 99) icon = '⛈️';

        document.getElementById('weather-info').textContent = `| ${temp}°F ${icon}`;
    } catch (e) {
        console.log("Error fetching weather", e);
    }
}

async function fetchAyatOfTheDay() {
    try {
        const ayahNumber = Math.floor(Math.random() * 6236) + 1;
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/editions/quran-uthmani,bn.bengali`);
        const data = await res.json();
        
        const arabic = data.data[0];
        const bangla = data.data[1];
        
        document.getElementById('ayat-arabic').textContent = arabic.text;
        document.getElementById('ayat-bangla').textContent = bangla.text;
        document.getElementById('ayat-reference').textContent = `Surah ${arabic.surah.englishName} (${arabic.surah.number}:${arabic.numberInSurah})`;
    } catch (e) {
        console.error("Error fetching Ayat", e);
        document.getElementById('ayat-arabic').textContent = "Unable to load Ayat.";
    }
}

const HADITHS = [
    {
        narrator: "Sahih al-Bukhari & Sahih Muslim",
        english: "The Prophet (ﷺ) said: 'None of you truly believes until he loves for his brother what he loves for himself.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'তোমাদের কেউ প্রকৃত মুমিন হতে পারবে না, যতক্ষণ না সে তার ভাইয়ের জন্য তা-ই পছন্দ করবে যা সে নিজের জন্য পছন্দ করে।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'The best among you are those who have the best manners and character.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'তোমাদের মধ্যে সর্বশ্রেষ্ঠ তারা, যাদের চরিত্র ও আচার-আচরণ সবচেয়ে সুন্দর।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'A good word is a charity.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'একটি ভালো কথা বলাও সাদাকাহ (দান)।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'The strong is not the one who overcomes the people by his strength, but the strong is the one who controls himself while in anger.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'প্রকৃত বীর সে নয় যে কুস্তিতে অন্যকে হারিয়ে দেয়, বরং প্রকৃত বীর সে যে রাগের মাথায় নিজেকে নিয়ন্ত্রণ করতে পারে।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'Allah does not look at your appearance or your wealth, but He looks at your hearts and your deeds.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'নিশ্চয়ই আল্লাহ তোমাদের চেহারা বা ধন-সম্পদের দিকে তাকান না, বরং তিনি তাকান তোমাদের অন্তর ও আমলের দিকে।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'Make things easy for people and do not make them difficult, and give good tidings and do not make people turn away.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'তোমরা মানুষের জন্য সহজ করো, কঠিন করো না; এবং সুসংবাদ দাও, মানুষকে দূরে ঠেলে দিও না।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'He who does not show mercy to others will not be shown mercy by Allah.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'যে ব্যক্তি মানুষের প্রতি দয়া করে না, আল্লাহও তার প্রতি দয়া করেন না।'"
    },
    {
        narrator: "Sunan at-Tirmidhi",
        english: "The Prophet (ﷺ) said: 'The world is sweet and green, and verily Allah has made you governors in it, to see how you will act.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'পৃথিবী মিষ্টি এবং সবুজ; এবং নিশ্চয়ই আল্লাহ তোমাদের এতে খলিফা বা প্রতিনিধি করেছেন, যেন তিনি দেখতে পারেন তোমরা কেমন কাজ করো।'"
    },
    {
        narrator: "Sahih Muslim",
        english: "The Prophet (ﷺ) said: 'Purity is half of faith.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'পবিত্রতা হচ্ছে ঈমানের অর্ধেক।'"
    },
    {
        narrator: "Sahih Muslim",
        english: "The Prophet (ﷺ) said: 'Keep to truthfulness, for truthfulness leads to righteousness, and righteousness leads to Paradise.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'তোমরা সত্যবাদী হও, কারণ সত্যবাদিতা নেক কাজের দিকে পরিচালিত করে, আর নেক কাজ জান্নাতের পথ দেখায়।'"
    },
    {
        narrator: "Sahih Muslim",
        english: "The Prophet (ﷺ) said: 'Do not underestimate any good deed, even if it is just meeting your brother with a cheerful face.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'কোনো ভালো কাজকেই তুচ্ছ মনে করো না, এমনকি তোমার ভাইয়ের সাথে একটু হাসিমুখে দেখা করা হলেও।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'The most beloved of deeds to Allah are those that are most consistent, even if they are small.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'আল্লাহর কাছে সবচেয়ে প্রিয় আমল হচ্ছে তা যা নিয়মিত করা হয়, তা পরিমাণে যতই কম হোক না কেন।'"
    },
    {
        narrator: "Sunan at-Tirmidhi",
        english: "The Prophet (ﷺ) said: 'Fear Allah wherever you are, and follow up a bad deed with a good deed which will wipe it out, and behave well towards people.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'তুমি যেখানেই থাকো আল্লাহকে ভয় করো, আর মন্দ কাজের পরপরই ভালো কাজ করো যা তাকে মিটিয়ে দেবে; এবং মানুষের সাথে উত্তম আচরণ করো।'"
    },
    {
        narrator: "Sahih Muslim",
        english: "The Prophet (ﷺ) said: 'Whoever follows a path in pursuit of knowledge, Allah will make easy for him a path to Paradise.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'যে ব্যক্তি জ্ঞান অর্জনের জন্য কোনো পথ অবলম্বন করে, আল্লাহ তার জন্য জান্নাতের পথ সহজ করে দেন।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'Whoever believes in Allah and the Last Day should speak good or remain silent.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'যে ব্যক্তি আল্লাহ ও শেষ দিবসের প্রতি বিশ্বাস রাখে, সে যেন ভালো কথা বলে অথবা নীরব থাকে।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'Whoever believes in Allah and the Last Day should be hospitable to his guest.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'যে ব্যক্তি আল্লাহ ও শেষ দিবসের প্রতি বিশ্বাস রাখে, সে যেন তার মেহমানকে সম্মান ও আপ্যায়ন করে।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'Allah is gentle and loves gentleness in all matters.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'নিশ্চয়ই আল্লাহ কোমল এবং তিনি প্রতিটি কাজে কোমলতা পছন্দ করেন।'"
    },
    {
        narrator: "Sunan at-Tirmidhi",
        english: "The Prophet (ﷺ) said: 'The most complete of believers in faith are those with the best character, and the best of you are those who are best to their wives.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'মুমিনদের মধ্যে ঈমানে সবচেয়ে পূর্ণাঙ্গ ব্যক্তি হচ্ছে সে, যার চরিত্র সবচেয়ে সুন্দর; আর তোমাদের মধ্যে উত্তম তারা, যারা তাদের স্ত্রীদের কাছে উত্তম।'"
    },
    {
        narrator: "Sahih Muslim",
        english: "The Prophet (ﷺ) said: 'Every good deed is a charity.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'প্রত্যেকটি ভালো কাজই একটি সাদাকাহ (দান)।'"
    },
    {
        narrator: "Sahih al-Bukhari",
        english: "The Prophet (ﷺ) said: 'Avoid jealousy, for jealousy devours good deeds just as fire devours firewood.'",
        bangla: "রাসূলুল্লাহ (সা.) বলেছেন: 'তোমরা হিংসা থেকে বেঁচে থাকো, কারণ হিংসা মানুষের নেক আমলসমূহকে সেভাবে গ্রাস করে যেভাবে আগুন লাকড়িকে পুড়িয়ে ফেলে।'"
    }
];

function fetchHadithOfTheDay() {
    try {
        const randomIndex = Math.floor(Math.random() * HADITHS.length);
        const hadith = HADITHS[randomIndex];
        
        document.getElementById('hadith-english').textContent = hadith.english;
        document.getElementById('hadith-bangla').textContent = hadith.bangla;
        document.getElementById('hadith-reference').textContent = `— ${hadith.narrator}`;
    } catch (e) {
        console.error("Error fetching Hadith", e);
        document.getElementById('hadith-english').textContent = "Unable to load Hadith.";
    }
}

function togglePrayerSetting(id) {
    prayerSettings[id] = !prayerSettings[id];
    localStorage.setItem('prayerSettings', JSON.stringify(prayerSettings));
    renderPrayerTimes();
}

// --- Web Audio API Enhancement ---
let audioCtx = null;
const audioNodes = {}; // cache source nodes per audio element id

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function buildEnhancedChain(audioEl) {
    const ctx = getAudioContext();

    // Create media element source (only once per element)
    if (!audioEl._sourceNode) {
        audioEl._sourceNode = ctx.createMediaElementSource(audioEl);
    }
    const source = audioEl._sourceNode;

    // 1. Bass Warmth — low shelf boost at 100 Hz
    const bassBoost = ctx.createBiquadFilter();
    bassBoost.type = 'lowshelf';
    bassBoost.frequency.value = 100;
    bassBoost.gain.value = 5;

    // 2. Vocal Presence — peaking boost at 2.5 kHz
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2500;
    presence.Q.value = 1.2;
    presence.gain.value = 4;

    // 3. Air / Brilliance — high shelf at 8 kHz
    const airBoost = ctx.createBiquadFilter();
    airBoost.type = 'highshelf';
    airBoost.frequency.value = 8000;
    airBoost.gain.value = 3;

    // 4. Dynamics Compressor — evens out loud/soft passages
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Chain: source → bass → presence → air → compressor → speakers
    source.connect(bassBoost);
    bassBoost.connect(presence);
    presence.connect(airBoost);
    airBoost.connect(compressor);
    compressor.connect(ctx.destination);
}

let activePlayPrayerId = null; // track which prayer id is currently playing

function playAdhanTest(audioId = 'adhan-audio', prayerId = null) {
    const audio = document.getElementById(audioId);
    if (!audio) return;

    // If this prayer's audio is already playing → pause it
    if (prayerId && prayerId === activePlayPrayerId && !audio.paused) {
        audio.pause();
        activePlayPrayerId = null;
        renderPrayerTimes();
        return;
    }

    // Stop any other playing audio
    ['adhan-audio', 'adhan-fajr-audio'].forEach(id => {
        const a = document.getElementById(id);
        if (a && !a.paused) { a.pause(); a.currentTime = 0; }
    });

    // Resume AudioContext if suspended (browser autoplay policy)
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
            playEnhanced(audio, audioId, prayerId);
        }).catch(e => {
            console.log("AudioContext resume failed, falling back to raw play", e);
            audio.currentTime = 0;
            audio.play().catch(err => console.log("Fallback play failed:", err));
            if (prayerId) {
                activePlayPrayerId = prayerId;
                renderPrayerTimes();
            }
            audio.onended = () => {
                activePlayPrayerId = null;
                renderPrayerTimes();
            };
        });
    } else {
        playEnhanced(audio, audioId, prayerId);
    }
}

function playEnhanced(audio, audioId, prayerId) {
    if (!audio._sourceNode) buildEnhancedChain(audio);
    audio.currentTime = 0;
    audio.play().catch(e => console.log("Audio play failed:", e));

    if (prayerId) {
        activePlayPrayerId = prayerId;
        renderPrayerTimes();
    }

    audio.onended = () => {
        activePlayPrayerId = null;
        renderPrayerTimes();
    };
}

async function fetchLocationName(lat, lon) {
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const data = await res.json();
        const locationName = data.locality || data.city || data.principalSubdivision || 'Unknown Location';
        document.getElementById('location-name').textContent = locationName;
        initTasbeeh(locationName);
    } catch (e) {
        document.getElementById('location-name').textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        initTasbeeh(`${lat.toFixed(2)},${lon.toFixed(2)}`);
    }
}

async function fetchPrayerTimes(lat, lon) {
    try {
        const date = new Date();
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        // Fetch timings with method=2 (Islamic Society of North America - ISNA) and configured school
        const schoolParam = appConfig.jurisprudence === 'hanafi' ? 1 : 0;
        const res = await fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=2&school=${schoolParam}`);
        const data = await res.json();
        
        prayerTimesData = data.data.timings;
        applyManualAdjustments();
        
        // Populate Hijri Date
        if (data.data && data.data.date && data.data.date.hijri) {
            const hijri = data.data.date.hijri;
            document.getElementById('hijri-date').textContent = `(${hijri.day} ${hijri.month.en} ${hijri.year} AH)`;
        }
        
        renderPrayerTimes();
        startCountdown();
    } catch (e) {
        console.error("Error fetching prayer times", e);
        document.getElementById('prayer-list').innerHTML = '<div class="loading">Error loading prayer times.</div>';
    }
}

async function fetchQibla(lat, lon) {
    try {
        const res = await fetch(`https://api.aladhan.com/v1/qibla/${lat}/${lon}`);
        const data = await res.json();
        const direction = data.data.direction;
        
        document.getElementById('qibla-degree').textContent = `${direction.toFixed(1)}°`;
        
        const needle = document.getElementById('compass-needle');
        needle.style.transform = `rotate(${direction}deg)`;
        
        window.qiblaDirection = direction;
    } catch (e) {
        console.error("Error fetching Qibla", e);
    }
}

let lastAlpha = 0;
function handleOrientation(event) {
    if (window.qiblaDirection === undefined) return;
    
    let heading = event.webkitCompassHeading;
    if (heading === undefined) {
        if (event.alpha !== null) {
            // Android alpha increases counter-clockwise, so clockwise heading is (360 - alpha) % 360
            heading = (360 - event.alpha) % 360;
        } else {
            return;
        }
    }
    
    lastAlpha = heading;
    const needle = document.getElementById('compass-needle');
    if (needle) {
        // Point the needle towards Qibla relative to the top of the phone
        needle.style.transform = `rotate(${window.qiblaDirection - heading}deg)`;
    }
}

function registerCompassListener() {
    if (window.DeviceOrientationEvent) {
        if ('ondeviceorientationabsolute' in window) {
            window.removeEventListener('deviceorientationabsolute', handleOrientation);
            window.addEventListener('deviceorientationabsolute', handleOrientation);
        } else {
            window.removeEventListener('deviceorientation', handleOrientation);
            window.addEventListener('deviceorientation', handleOrientation);
        }
        
        // Show glowing green indicator for Active Live Compass next to the Qibla Title
        const qiblaTitle = document.querySelector('.small-qibla-section .qibla-info h3');
        if (qiblaTitle && !document.getElementById('live-compass-indicator')) {
            qiblaTitle.innerHTML = 'QIBLA <span id="live-compass-indicator" style="display:inline-block; width:8px; height:8px; background:#2ecc71; border-radius:50%; margin-left:5px; box-shadow:0 0 8px #2ecc71;" title="Live Compass Active"></span>';
        }
    } else {
        console.warn("Compass sensors not supported on this device.");
    }
}

function requestCompassPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    registerCompassListener();
                    document.getElementById('enable-compass-btn').style.display = 'none';
                } else {
                    alert('Compass permission denied. The compass will not point to real-world Qibla.');
                }
            })
            .catch(console.error);
    } else {
        // For Android / non-iOS devices that don't need requestPermission
        registerCompassListener();
        document.getElementById('enable-compass-btn').style.display = 'none';
    }
}

function renderPrayerTimes() {
    const container = document.getElementById('prayer-list');
    container.innerHTML = '';
    
    const now = new Date();
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    let activeIndex = -1;
    let nextIndex = 0;
    
    for (let i = 0; i < PRAYERS.length; i++) {
        const time = prayerTimesData[PRAYERS[i].id];
        if (currentTimeStr >= time) {
            activeIndex = i;
            nextIndex = (i + 1) % PRAYERS.length;
        }
    }
    if (activeIndex === -1) {
        nextIndex = 0;
    }
    
    window.nextPrayerIndex = nextIndex;
    
    let previousIndex = currentPrayerIndex;
    currentPrayerIndex = activeIndex;
    
    // Play Adhan if transitioning to a new prayer
    if (previousIndex !== -1 && previousIndex !== activeIndex) {
        const nextPrayerId = PRAYERS[activeIndex].id;
        if (prayerSettings[nextPrayerId] && nextPrayerId !== 'Sunrise' && nextPrayerId !== 'Sunset') {
            const isFajr = nextPrayerId === 'Fajr';
            const audioId = isFajr ? 'adhan-fajr-audio' : 'adhan-audio';
            playAdhanTest(audioId, nextPrayerId);
        }
    }

    PRAYERS.forEach((prayer, index) => {
        const time = prayerTimesData[prayer.id];
        const timeObj = parseTime(time);
        
        const isCurrent = index === activeIndex;
        
        const card = document.createElement('div');
        card.className = `prayer-card ${isCurrent ? 'current' : ''}`;
        
        const isQuiet = prayer.id === 'Sunrise' || prayer.id === 'Sunset';
        const isFajr = prayer.id === 'Fajr';
        const audioId = isFajr ? 'adhan-fajr-audio' : 'adhan-audio';
        const isPlayingThis = activePlayPrayerId === prayer.id;

        card.innerHTML = `
            <div class="prayer-info">
                <span class="prayer-name">${index + 1}. ${prayer.name}</span>
                <span class="prayer-time">${formatTime(timeObj)}</span>
            </div>
            <div class="prayer-actions">
                ${!isQuiet ? `
                <button class="action-btn play-btn" onclick="playAdhanTest('${audioId}', '${prayer.id}')" title="Play Adhan">
                    <i class="fa-solid ${isPlayingThis ? 'fa-pause' : 'fa-play'}"></i>
                </button>
                <button class="action-btn toggle-btn" onclick="togglePrayerSetting('${prayer.id}')" title="Toggle Notification">
                    <i class="fa-solid ${prayerSettings[prayer.id] ? 'fa-bell' : 'fa-bell-slash'}"></i>
                </button>` : ''}
                <div class="prayer-icon">
                    <i class="fa-solid ${prayer.icon}"></i>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return d;
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        updateCountdown();
    }, 1000);
    updateCountdown();
}

function updateCountdown() {
    if (window.nextPrayerIndex === undefined || !prayerTimesData) return;
    
    const nextPrayer = PRAYERS[window.nextPrayerIndex];
    let targetTime = parseTime(prayerTimesData[nextPrayer.id]);
    const now = new Date();
    
    if (targetTime < now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    
    if (diff <= 0) {
        renderPrayerTimes();
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    document.getElementById('next-prayer-name').textContent = nextPrayer.name;
    document.getElementById('countdown').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
    let prevPrayerIndex = window.nextPrayerIndex - 1;
    if (prevPrayerIndex < 0) prevPrayerIndex = PRAYERS.length - 1;
    
    let prevTime = parseTime(prayerTimesData[PRAYERS[prevPrayerIndex].id]);
    if (prevTime > targetTime) {
        prevTime.setDate(prevTime.getDate() - 1);
    }
    
    const totalDiff = targetTime - prevTime;
    const progressPercent = 100 - ((diff / totalDiff) * 100);
    
    document.getElementById('progress').style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
}

// Calendar and Settings Modals Logic
document.addEventListener('DOMContentLoaded', () => {
    const calendarModal = document.getElementById('calendar-modal');
    const openCalendarBtn = document.getElementById('open-calendar-btn');
    const closeCalendarBtn = document.getElementById('close-calendar-btn');

    if (openCalendarBtn && calendarModal && closeCalendarBtn) {
        openCalendarBtn.onclick = function() {
            calendarModal.style.display = "block";
        }

        closeCalendarBtn.onclick = function() {
            calendarModal.style.display = "none";
        }
    }

    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('settings-save-btn');

    if (openSettingsBtn && settingsModal && closeSettingsBtn && saveSettingsBtn) {
        // Open settings modal and populate inputs from localStorage appConfig
        openSettingsBtn.onclick = function() {
            // Populate theme radios
            const themeRadios = document.getElementsByName('setting-theme');
            themeRadios.forEach(radio => {
                radio.checked = (radio.value === appConfig.theme);
            });

            // Populate jurisprudence radios
            const jurisRadios = document.getElementsByName('setting-juris');
            jurisRadios.forEach(radio => {
                radio.checked = (radio.value === appConfig.jurisprudence);
            });

            // Populate manual offset input values
            PRAYERS.forEach(prayer => {
                const input = document.getElementById(`adj-${prayer.id}`);
                if (input) {
                    input.value = appConfig.manualAdjustments[prayer.id] || 0;
                }
            });

            settingsModal.style.display = "block";
        }

        // Close settings modal
        closeSettingsBtn.onclick = function() {
            settingsModal.style.display = "none";
        }

        // Save settings and reload page data
        saveSettingsBtn.onclick = async function() {
            // Read theme
            const selectedTheme = document.querySelector('input[name="setting-theme"]:checked').value;
            appConfig.theme = selectedTheme;
            if (selectedTheme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }

            // Read jurisprudence
            const selectedJuris = document.querySelector('input[name="setting-juris"]:checked').value;
            appConfig.jurisprudence = selectedJuris;

            // Read offsets
            PRAYERS.forEach(prayer => {
                const input = document.getElementById(`adj-${prayer.id}`);
                if (input) {
                    appConfig.manualAdjustments[prayer.id] = parseInt(input.value) || 0;
                }
            });

            // Save to localStorage
            localStorage.setItem('appConfig', JSON.stringify(appConfig));

            // Close modal
            settingsModal.style.display = "none";

            // Re-fetch and re-render everything
            if (window.currentLat !== undefined && window.currentLon !== undefined) {
                const locEl = document.getElementById('location-name');
                const oldLoc = locEl.textContent;
                locEl.textContent = "Updating...";
                await loadAppData(window.currentLat, window.currentLon, oldLoc === "Updating..." ? null : oldLoc);
            }
        }
    }

    // Single window click handler to close any active modal on overlay click
    window.addEventListener('click', (event) => {
        if (calendarModal && event.target === calendarModal) {
            calendarModal.style.display = "none";
        }
        if (settingsModal && event.target === settingsModal) {
            settingsModal.style.display = "none";
        }
    });
});

async function fetchCalendar(lat, lon) {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        // Fetch calendar with method=2 (Islamic Society of North America - ISNA) and configured school
        const schoolParam = appConfig.jurisprudence === 'hanafi' ? 1 : 0;
        const res = await fetch(`https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=2&school=${schoolParam}`);
        const data = await res.json();
        const days = data.data;
        
        if (days && days.length > 0) {
            const firstHijri = days[0].date.hijri;
            const monthName = firstHijri.month.en + ' ' + firstHijri.year + ' AH';
            document.getElementById('calendar-month-name').textContent = monthName;
            
            const tbody = document.getElementById('calendar-body');
            tbody.innerHTML = '';
            
            days.forEach(dayInfo => {
                const tr = document.createElement('tr');
                const enDate = dayInfo.date.gregorian.date;
                const hijriDate = `${dayInfo.date.hijri.day} ${dayInfo.date.hijri.month.en}`;
                const weekDay = dayInfo.date.gregorian.weekday.en;
                
                tr.innerHTML = `
                    <td>${weekDay}</td>
                    <td>${enDate}</td>
                    <td>${hijriDate}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Error fetching calendar", e);
        document.getElementById('calendar-body').innerHTML = '<tr><td colspan="3">Failed to load calendar.</td></tr>';
    }
}

// --- Tasbeeh Counter ---
let tasbeehCount = 0;
let tasbeehCity = 'default';

function getTasbeehKey(city) {
    return `tasbeeh_${city.replace(/\s+/g, '_').toLowerCase()}`;
}

function initTasbeeh(cityName) {
    tasbeehCity = cityName || 'default';
    const key = getTasbeehKey(tasbeehCity);
    const saved = localStorage.getItem(key);

    // Load saved count if available
    const data = saved ? JSON.parse(saved) : { count: 0, lastSaved: null };
    tasbeehCount = data.count || 0;

    document.getElementById('tasbeeh-count').textContent = tasbeehCount;

    updateSavedDisplay(data.lastSaved);
}

function updateSavedDisplay(lastSaved) {
    const el = document.getElementById('tasbeeh-saved-display');
    if (lastSaved) {
        el.textContent = `Last saved: ${new Date(lastSaved).toLocaleString()}`;
    } else {
        el.textContent = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tapBtn = document.getElementById('tasbeeh-tap-btn');
    const resetBtn = document.getElementById('tasbeeh-reset-btn');
    const saveBtn = document.getElementById('tasbeeh-save-btn');
    const countEl = document.getElementById('tasbeeh-count');

    if (tapBtn) {
        tapBtn.addEventListener('click', () => {
            tasbeehCount++;
            countEl.textContent = tasbeehCount;

            // Pulse animation
            countEl.classList.remove('pulse');
            void countEl.offsetWidth; // reflow to restart animation
            countEl.classList.add('pulse');
            setTimeout(() => countEl.classList.remove('pulse'), 150);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            tasbeehCount = 0;
            countEl.textContent = 0;
            document.getElementById('tasbeeh-saved-display').textContent = '';
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const key = getTasbeehKey(tasbeehCity);
            const now = new Date().toISOString();
            localStorage.setItem(key, JSON.stringify({ count: tasbeehCount, lastSaved: now }));
            updateSavedDisplay(now);

            // Flash save button as feedback
            saveBtn.style.background = 'rgba(46,204,113,0.5)';
            setTimeout(() => saveBtn.style.background = '', 600);
        });
    }

    // Hook up audio status button
    const statusBtn = document.getElementById('audio-status-btn');
    if (statusBtn) {
        statusBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid double execution from document listener
            unlockAudio();
        });
    }

    // Unlock audio on ANY user click or touch gesture on the page
    document.addEventListener('click', unlockAudioPageListener);
    document.addEventListener('touchstart', unlockAudioPageListener);
});

// --- Browser Autoplay Unlocker ---
let isAudioUnlocked = false;

function unlockAudio() {
    if (isAudioUnlocked) return;
    
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(e => console.log("Context resume failed during unlock:", e));
    }
    
    // Play and immediately pause both audio elements to bypass autoplay restrictions
    ['adhan-audio', 'adhan-fajr-audio'].forEach(id => {
        const audio = document.getElementById(id);
        if (audio) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    console.log(`Autoplay restriction bypassed for: ${id}`);
                }).catch(e => {
                    console.log(`Failed to bypass autoplay for ${id}:`, e);
                });
            }
        }
    });

    isAudioUnlocked = true;
    
    // Update header status button
    const btn = document.getElementById('audio-status-btn');
    if (btn) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Sound Enabled';
        btn.title = "Automatic Adhan Sound is fully active!";
    }

    // Clean up gesture event listeners
    document.removeEventListener('click', unlockAudioPageListener);
    document.removeEventListener('touchstart', unlockAudioPageListener);
}

function unlockAudioPageListener() {
    unlockAudio();
}

