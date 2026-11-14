/**
 * Weather & Date Service (Hero Card)
 * 
 * Provides:
 * 1. Dynamic Greeting based on time of day (Good morning / afternoon / evening)
 * 2. Compact date: DAY DD MON in caps (e.g. WED 11 NOV)
 * 3. Live Weather integration via Open-Meteo API with local caching & graceful fallbacks
 * 4. Tesla-inspired compact automotive weather lockup
 */

const WEATHER_CACHE_KEY = 'lifestyle_weather_data_v1';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Configured default location: the Lugarno site. The name shown comes from SITES (scripts/application/selectors.js).
const DEFAULT_WEATHER_LOCATION = {
    siteId: 'lugarno',
    get name() { return getSiteName(this.siteId, 'Lugarno'); },
    latitude: -33.9961,
    longitude: 151.0475
};

// Global reference for modal and other features
window.CURRENT_WEATHER_DATA = null;

/**
 * Compact hero date, Australian day-month order in caps: "WED 11 NOV"
 */
function getAustralianFormattedDate(date = new Date()) {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Get greeting based on current local hour
 */
function getGreetingSalutation(hour = new Date().getHours()) {
    if (hour >= 5 && hour < 12) {
        return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
        return 'Good afternoon';
    } else {
        return 'Good evening';
    }
}

/**
 * Update the hero greeting and date display dynamically
 */
function updateHeroGreetingAndDate() {
    const now = new Date();
    const salutationEl = document.getElementById('hero-salutation');
    const dateEl = document.getElementById('hero-date');

    if (salutationEl) {
        salutationEl.textContent = getGreetingSalutation(now.getHours());
    }
    if (dateEl) {
        dateEl.textContent = getAustralianFormattedDate(now);
    }
}

/**
 * Map WMO weather codes to conditions and FontAwesome icons
 */
function mapWmoCode(code, isDay = 1) {
    // Standard WMO Weather interpretation codes (WW)
    switch (code) {
        case 0:
            return {
                condition: 'Clear',
                icon: isDay ? 'fa-sun' : 'fa-moon',
                iconColor: isDay ? 'text-amber-300' : 'text-indigo-300'
            };
        case 1:
        case 2:
            return {
                condition: 'Partly Cloudy',
                icon: isDay ? 'fa-cloud-sun' : 'fa-cloud-moon',
                iconColor: 'text-cyan-300'
            };
        case 3:
            return {
                condition: 'Overcast',
                icon: 'fa-cloud',
                iconColor: 'text-slate-300'
            };
        case 45:
        case 48:
            return {
                condition: 'Foggy',
                icon: 'fa-smog',
                iconColor: 'text-slate-300'
            };
        case 51:
        case 53:
        case 55:
            return {
                condition: 'Drizzle',
                icon: 'fa-cloud-rain',
                iconColor: 'text-cyan-300'
            };
        case 61:
        case 63:
            return {
                condition: 'Rain',
                icon: 'fa-cloud-showers-heavy',
                iconColor: 'text-cyan-300'
            };
        case 65:
            return {
                condition: 'Heavy Rain',
                icon: 'fa-cloud-showers-water',
                iconColor: 'text-blue-400'
            };
        case 71:
        case 73:
        case 75:
            return {
                condition: 'Snow',
                icon: 'fa-snowflake',
                iconColor: 'text-sky-200'
            };
        case 80:
        case 81:
        case 82:
            return {
                condition: 'Showers',
                icon: 'fa-cloud-rain',
                iconColor: 'text-cyan-300'
            };
        case 95:
        case 96:
        case 99:
            return {
                condition: 'Thunderstorm',
                icon: 'fa-bolt',
                iconColor: 'text-amber-400'
            };
        default:
            return {
                condition: 'Mild',
                icon: 'fa-cloud-sun',
                iconColor: 'text-cyan-300'
            };
    }
}

/**
 * Gradient tone for the hero weather glyph, from its icon (so cached data without a tone still works)
 */
function getWeatherIconTone(icon) {
    switch (icon) {
        case 'fa-sun': return 'sun';
        case 'fa-moon': return 'moon';
        case 'fa-cloud-sun': return 'partly';
        case 'fa-cloud-moon': return 'partly-night';
        case 'fa-cloud':
        case 'fa-smog': return 'cloud';
        case 'fa-cloud-showers-water': return 'heavy-rain';
        case 'fa-cloud-rain':
        case 'fa-cloud-showers-heavy': return 'rain';
        case 'fa-snowflake': return 'snow';
        case 'fa-bolt': return 'storm';
        default: return 'partly';
    }
}

/**
 * Render weather data to the Hero Card UI
 */
function renderHeroWeather(data) {
    if (!data) return;
    window.CURRENT_WEATHER_DATA = data;

    const tempEl = document.getElementById('hero-weather-temp');
    const conditionEl = document.getElementById('hero-weather-condition');
    const iconContainer = document.getElementById('hero-weather-icon');
    const btnEl = document.getElementById('hero-weather-module');

    if (tempEl) tempEl.textContent = `${Math.round(data.temp)}°`;
    if (conditionEl) conditionEl.textContent = data.condition;
    // High/low and location live in the weather detail sheet, not the compact widget

    if (iconContainer) {
        iconContainer.className = `${data.iconColor || 'text-cyan-300'} text-2xl transition-transform duration-300 group-hover/weather:scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]`;
        iconContainer.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
        // Gradient fill + glow per condition (styles/home-dark.css)
        iconContainer.dataset.wxTone = getWeatherIconTone(data.icon);
    }

    if (btnEl) {
        btnEl.setAttribute(
            'aria-label',
            `Weather for ${data.locationName}: ${Math.round(data.temp)} degrees, ${data.condition}. Tap for details.`
        );
    }
}

/**
 * Load cached weather if valid
 */
function getCachedWeather() {
    try {
        const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < WEATHER_CACHE_TTL_MS) {
            return parsed.data;
        }
    } catch (_) {}
    return null;
}

/**
 * Save weather data to session cache
 */
function setCachedWeather(data) {
    try {
        sessionStorage.setItem(
            WEATHER_CACHE_KEY,
            JSON.stringify({ timestamp: Date.now(), data })
        );
    } catch (_) {}
}

/**
 * Fetch live weather from Open-Meteo
 */
async function fetchLiveWeather() {
    // 1. Check cache first for instant zero-latency paint
    const cached = getCachedWeather();
    if (cached) {
        renderHeroWeather(cached);
    }

    // 2. Determine target coordinates
    let target = { ...DEFAULT_WEATHER_LOCATION };

    // Check if geolocation permission was already granted previously
    // (Never prompt or disturb the user if not granted)
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            if (status.state === 'granted' && navigator.geolocation) {
                await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            target = {
                                name: 'Local',
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude
                            };
                            resolve();
                        },
                        () => resolve(),
                        { timeout: 3000, maximumAge: 300000 }
                    );
                });
            }
        } catch (_) {}
    }

    // 3. Request Open-Meteo Forecast
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.latitude.toFixed(4)}&longitude=${target.longitude.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
        const json = await res.json();

        const current = json.current || {};
        const daily = json.daily || {};

        const weatherMeta = mapWmoCode(current.weather_code ?? 0, current.is_day ?? 1);

        const weatherData = {
            temp: current.temperature_2m ?? 21,
            feelsLike: current.apparent_temperature ?? current.temperature_2m ?? 21,
            humidity: current.relative_humidity_2m ?? 65,
            windSpeed: current.wind_speed_10m ?? 12,
            precipitation: current.precipitation ?? 0,
            precipitationProb: daily.precipitation_probability_max?.[0] ?? 20,
            tempMax: daily.temperature_2m_max?.[0] ?? (current.temperature_2m ? current.temperature_2m + 3 : 24),
            tempMin: daily.temperature_2m_min?.[0] ?? (current.temperature_2m ? current.temperature_2m - 5 : 15),
            condition: weatherMeta.condition,
            icon: weatherMeta.icon,
            iconColor: weatherMeta.iconColor,
            locationName: target.name
        };

        setCachedWeather(weatherData);
        renderHeroWeather(weatherData);
    } catch (err) {
        console.warn('Weather fetch notice (using cache/fallback):', err);
        // If we haven't rendered cached data yet, apply sensible fallback
        if (!window.CURRENT_WEATHER_DATA) {
            const fallbackData = {
                temp: 21,
                feelsLike: 21,
                humidity: 62,
                windSpeed: 14,
                precipitation: 0,
                precipitationProb: 15,
                tempMax: 24,
                tempMin: 15,
                condition: 'Partly Cloudy',
                icon: 'fa-cloud-sun',
                iconColor: 'text-cyan-300',
                locationName: DEFAULT_WEATHER_LOCATION.name
            };
            renderHeroWeather(fallbackData);
        }
    }
}

/**
 * Initialize Hero Weather and Greeting Engine
 */
function initHeroWeatherAndDate() {
    updateHeroGreetingAndDate();
    fetchLiveWeather();

    // Re-check greeting/date every 60 seconds
    setInterval(updateHeroGreetingAndDate, 60000);

    // Refresh weather data every 15 minutes
    setInterval(fetchLiveWeather, WEATHER_CACHE_TTL_MS);
}

// Auto boot on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroWeatherAndDate);
} else {
    initHeroWeatherAndDate();
}
