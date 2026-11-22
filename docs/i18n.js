/* i18n.js: English and Urdu strings. Placeholders look like {v}. Have a native Urdu speaker review the Urdu text. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SW_I18N = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const en = {
    app_name: 'SmogWatch Punjab',
    city_label: 'Choose a city',
    lang_btn: 'اردو',
    theme_btn: 'Switch light / dark theme',
    info_btn: 'About this site',
    layers_label: 'Map layers',

    ly_cities: 'Cities', ly_sensors: 'Sensors', ly_fires: 'Fires', ly_wind: 'Wind', ly_cone: 'Smoke sector',

    tab_now: 'Now', tab_smog: 'Smog', tab_trends: 'Trends', tab_rank: 'Ranking',

    updated: 'Updated', pk_time: 'Pakistan time', stale: 'Data is {h} h old',
    src_measured: 'Measured', src_modelled: 'Modelled estimate',
    src_measured_tip: 'Average of real sensors near this city (OpenAQ).',
    src_modelled_tip: 'Atmospheric model estimate (Open-Meteo, CAMS). No fresh sensor reading nearby.',

    aqi: 'AQI', no_data: 'No data',
    cat_good: 'Good', cat_moderate: 'Moderate', cat_usg: 'Unhealthy for sensitive groups',
    cat_unhealthy: 'Unhealthy', cat_veryUnhealthy: 'Very unhealthy', cat_hazardous: 'Hazardous',

    pm25_now: 'PM2.5 now',
    who_times: '{x}× the WHO daily guideline (15 µg/m³)',
    who_ok: 'Within the WHO daily guideline (15 µg/m³)',
    yday_line: 'Same hour yesterday: {v}',

    advice_title: 'Health advice', adv_public: 'General public', adv_sensitive: 'Sensitive groups',
    adv_who: 'Sensitive groups: children, older adults, pregnant women, outdoor workers, and people with asthma or heart disease.',
    adv_good_gen: 'Air is clean. Normal outdoor activity is fine.',
    adv_good_sens: 'No special precautions.',
    adv_moderate_gen: 'Acceptable for most people.',
    adv_moderate_sens: 'Very sensitive people should shorten long outdoor exertion.',
    adv_usg_gen: 'Reduce long or heavy outdoor exertion.',
    adv_usg_sens: 'Children, older adults and people with asthma or heart disease should limit time outdoors and keep medicines ready.',
    adv_unhealthy_gen: 'Avoid long outdoor exertion. Wear an N95 mask outdoors.',
    adv_unhealthy_sens: 'Stay indoors with windows closed. See a doctor if breathing is difficult.',
    adv_veryUnhealthy_gen: 'Avoid outdoor activity.',
    adv_veryUnhealthy_sens: 'Stay indoors, use an air purifier if you have one, and get medical help for symptoms.',
    adv_hazardous_gen: 'Stay indoors and avoid all outdoor exertion.',
    adv_hazardous_sens: 'Remain indoors and seek medical help for any breathing trouble.',

    wx_title: 'Weather now', wx_temp: 'Temperature', wx_hum: 'Humidity', wx_wind: 'Wind',
    wx_vis: 'Visibility', wx_blh: 'Mixing height',
    wx_blh_tip: 'Boundary layer height: the "lid" that traps pollution near the ground. Lower means more smog.',
    wx_from: 'from {d}',
    dir_N: 'N', dir_NE: 'NE', dir_E: 'E', dir_SE: 'SE', dir_S: 'S', dir_SW: 'SW', dir_W: 'W', dir_NW: 'NW',
    pol_title: 'Pollutants now',

    smog_title: 'Smog risk', smog_score: 'Risk score {v} / 100',
    lvl_Low: 'Low', lvl_Moderate: 'Moderate', lvl_High: 'High', lvl_Severe: 'Severe',
    smog_why: 'Why', smog_none: 'No smog warning signs right now.',
    smog_unavailable: 'Smog data is not available yet.',
    why_pm_high: 'PM2.5 is {v} µg/m³, in the unhealthy range',
    why_wind_weak: 'Weak wind ({v} m/s) lets pollution build up',
    why_blh_low: 'Low mixing height ({v} m) keeps pollution near the ground',
    why_vis_low: 'Low visibility ({v} km)',
    why_hum_high: 'High humidity ({v} %) can thicken fog and haze',
    why_fires_up: '{v} fire detections upwind',

    fires_near: 'Fires within 150 km', fires_up: 'Fires upwind (300 km)',
    show_cone: 'Show smoke sector on map', hide_cone: 'Hide smoke sector',
    cone_hint: 'The orange wedge points to where the wind is coming from. Fires inside it can send smoke to this city.',

    best_title: 'Best time to go outside',
    day_today: 'Today', day_tomorrow: 'Tomorrow',
    best_line: '{day}, {from} to {to}', worst_line: 'Worst: {day}, {from} to {to}',
    best_pm: 'about {v} µg/m³',
    best_note: 'From the hourly model forecast, daytime only (6 am to 9 pm). A guide, not a guarantee.',
    best_none: 'Not enough forecast data yet.',

    fc_title: 'Tomorrow: XGBoost forecast', fc_sub: 'Average PM2.5 over the next 24 hours',
    fc_error: 'Typical error ±{v} µg/m³',
    fc_higher: '{p}% higher than now', fc_lower: '{p}% lower than now', fc_same: 'About the same as now',
    fc_note: 'Experimental. Learned from past sensor data, so use it as a guide.',
    fc_none: 'The forecast is not available yet.',

    chk_title: 'Model vs sensors nearby',
    chk_line: '{n} sensors within 25 km read about {s} µg/m³. The model says {m}.',
    chk_lower: 'The model reads about {p}% lower than the sensors.',
    chk_higher: 'The model reads about {p}% higher than the sensors.',
    chk_close: 'The model and the sensors agree closely.',

    tr_trend: 'PM2.5: last 48 h and next 72 h', tr_heat: 'Last 7 days, hour by hour (AQI)',
    tr_past: 'Past', tr_model: 'Model forecast', tr_xgb: 'XGBoost (+24 h)', tr_now: 'Now', tr_who: 'WHO guideline',

    rk_filter: 'Search a city', rk_worst: 'Highest', rk_clean: 'Lowest', rk_avg: 'Average AQI',
    rk_none: 'No cities match.', rk_title: 'City ranking (AQI)',

    tl_play: 'Play the last 7 days', tl_pause: 'Pause', tl_now: 'Now', tl_back: 'Back to now',
    tl_replay: 'Replay (model estimate)', tl_forecast: 'Forecast (model)', tl_live: 'Live',
    tl_label: 'Time', replay_note: 'Replay and forecast use model estimates, not sensor readings.',

    st_title: 'Sensor', st_ago_min: '{m} min ago', st_ago_h: '{h} h ago', sensors_count: '{n} sensors',

    about_title: 'About SmogWatch Punjab',
    about_intro: 'A free, live air quality and smog dashboard for Punjab, Pakistan. It refreshes every hour.',
    about_sources: 'Data sources',
    about_src_1: 'Air quality and weather model: Open-Meteo (CAMS ENSEMBLE data).',
    about_src_2: 'Ground sensors: OpenAQ. Many are low-cost community sensors, so quality varies.',
    about_src_3: 'Fire hotspots: NASA FIRMS (VIIRS satellites).',
    about_src_4: 'Basemap: OpenStreetMap contributors, OpenFreeMap and CARTO.',
    about_aqi_t: 'How the AQI is calculated',
    about_aqi: 'The AQI is calculated from PM2.5 only, using U.S. EPA categories. It can differ from the official Punjab EPA wording.',
    about_mm_t: 'Measured vs modelled',
    about_mm: '"Measured" means the value is an average of real sensors near the city. "Modelled estimate" comes from an atmospheric model and may differ from a sensor.',
    about_smog_t: 'Smog risk score',
    about_smog: 'A rule-based score from PM2.5, weak wind, low mixing height, low visibility, humidity and fires upwind. It is an index, not a scientific measurement.',
    about_fc_t: 'XGBoost forecast',
    about_fc: 'A machine learning model predicts the average PM2.5 for the next 24 hours. Its typical error is shown next to every forecast.',
    about_health: 'Health text is general guidance, not medical advice.',
    about_close: 'Close',

    loading: 'Loading air quality data…', load_fail: 'Could not load data', retry: 'Try again'
  };

  const ur = {
    app_name: 'سموگ واچ پنجاب',
    city_label: 'شہر منتخب کریں',
    lang_btn: 'English',
    theme_btn: 'روشن / تاریک تھیم بدلیں',
    info_btn: 'اس سائٹ کے بارے میں',
    layers_label: 'نقشے کی تہیں',

    ly_cities: 'شہر', ly_sensors: 'سینسر', ly_fires: 'آگ', ly_wind: 'ہوا', ly_cone: 'دھوئیں کا رخ',

    tab_now: 'ابھی', tab_smog: 'سموگ', tab_trends: 'رجحان', tab_rank: 'درجہ بندی',

    updated: 'تازہ کاری', pk_time: 'پاکستانی وقت', stale: 'ڈیٹا {h} گھنٹے پرانا ہے',
    src_measured: 'ناپا گیا', src_modelled: 'ماڈل کا اندازہ',
    src_measured_tip: 'اس شہر کے قریب حقیقی سینسروں کی اوسط (OpenAQ)۔',
    src_modelled_tip: 'فضائی ماڈل کا اندازہ (Open-Meteo, CAMS)۔ قریب کوئی تازہ سینسر ریڈنگ نہیں۔',

    aqi: 'اے کیو آئی', no_data: 'ڈیٹا دستیاب نہیں',
    cat_good: 'اچھی', cat_moderate: 'درمیانی', cat_usg: 'حساس افراد کے لیے مضر',
    cat_unhealthy: 'مضرِ صحت', cat_veryUnhealthy: 'انتہائی مضرِ صحت', cat_hazardous: 'خطرناک',

    pm25_now: 'اس وقت PM2.5',
    who_times: 'عالمی ادارۂ صحت کی یومیہ حد (15 µg/m³) سے {x} گنا',
    who_ok: 'عالمی ادارۂ صحت کی یومیہ حد (15 µg/m³) کے اندر',
    yday_line: 'کل اسی وقت: {v}',

    advice_title: 'صحت سے متعلق مشورہ', adv_public: 'عام لوگ', adv_sensitive: 'حساس افراد',
    adv_who: 'حساس افراد: بچے، بزرگ، حاملہ خواتین، کھلی فضا میں کام کرنے والے، اور دمہ یا دل کے مریض۔',
    adv_good_gen: 'ہوا صاف ہے۔ معمول کی بیرونی سرگرمیاں ٹھیک ہیں۔',
    adv_good_sens: 'کسی خاص احتیاط کی ضرورت نہیں۔',
    adv_moderate_gen: 'زیادہ تر لوگوں کے لیے قابلِ قبول ہے۔',
    adv_moderate_sens: 'بہت حساس افراد لمبی بیرونی مشقت کم کریں۔',
    adv_usg_gen: 'لمبی یا سخت بیرونی مشقت کم کریں۔',
    adv_usg_sens: 'بچے، بزرگ اور دمہ یا دل کے مریض باہر کم وقت گزاریں اور اپنی دوائیں ساتھ رکھیں۔',
    adv_unhealthy_gen: 'لمبی بیرونی مشقت سے پرہیز کریں۔ باہر نکلتے وقت N95 ماسک پہنیں۔',
    adv_unhealthy_sens: 'گھر کے اندر رہیں اور کھڑکیاں بند رکھیں۔ سانس میں دشواری ہو تو ڈاکٹر سے رجوع کریں۔',
    adv_veryUnhealthy_gen: 'بیرونی سرگرمیوں سے پرہیز کریں۔',
    adv_veryUnhealthy_sens: 'گھر کے اندر رہیں، ہوا صاف کرنے والا پیوریفائر ہو تو استعمال کریں، اور علامات ہوں تو طبی مدد لیں۔',
    adv_hazardous_gen: 'گھر کے اندر رہیں اور ہر قسم کی بیرونی مشقت سے بچیں۔',
    adv_hazardous_sens: 'گھر میں رہیں اور سانس کی کسی بھی تکلیف پر فوراً طبی مدد حاصل کریں۔',

    wx_title: 'اس وقت کا موسم', wx_temp: 'درجہ حرارت', wx_hum: 'نمی', wx_wind: 'ہوا',
    wx_vis: 'نظر آنے کا فاصلہ', wx_blh: 'ہوا کی تہہ کی اونچائی',
    wx_blh_tip: 'فضا کی وہ تہہ جو آلودگی کو زمین کے قریب روک لیتی ہے۔ جتنی کم ہو، اتنی زیادہ سموگ۔',
    wx_from: '{d} سے',
    dir_N: 'شمال', dir_NE: 'شمال مشرق', dir_E: 'مشرق', dir_SE: 'جنوب مشرق',
    dir_S: 'جنوب', dir_SW: 'جنوب مغرب', dir_W: 'مغرب', dir_NW: 'شمال مغرب',
    pol_title: 'اس وقت کی آلودگی',

    smog_title: 'سموگ کا خطرہ', smog_score: 'خطرے کا اسکور {v} / 100',
    lvl_Low: 'کم', lvl_Moderate: 'درمیانہ', lvl_High: 'زیادہ', lvl_Severe: 'شدید',
    smog_why: 'وجوہات', smog_none: 'اس وقت سموگ کی کوئی خاص علامت نہیں۔',
    smog_unavailable: 'سموگ کا ڈیٹا ابھی دستیاب نہیں۔',
    why_pm_high: 'PM2.5 {v} µg/m³ ہے، جو مضرِ صحت حد میں ہے',
    why_wind_weak: 'ہوا کمزور ہے ({v} m/s) اس لیے آلودگی جمع ہو رہی ہے',
    why_blh_low: 'ہوا کی تہہ نیچی ہے ({v} m) اور آلودگی زمین کے قریب رکی ہوئی ہے',
    why_vis_low: 'نظر آنے کا فاصلہ کم ہے ({v} km)',
    why_hum_high: 'زیادہ نمی ({v} %) دھند اور دھندلاہٹ کو گاڑھا کر سکتی ہے',
    why_fires_up: 'ہوا کے رخ پر {v} آگ کی نشاندہیاں',

    fires_near: '150 کلومیٹر کے اندر آگ', fires_up: 'ہوا کے رخ پر آگ (300 کلومیٹر)',
    show_cone: 'نقشے پر دھوئیں کا رخ دکھائیں', hide_cone: 'دھوئیں کا رخ چھپائیں',
    cone_hint: 'نارنجی تکون اس طرف اشارہ کرتی ہے جہاں سے ہوا آ رہی ہے۔ اس کے اندر کی آگ اس شہر تک دھواں پہنچا سکتی ہے۔',

    best_title: 'باہر جانے کا بہترین وقت',
    day_today: 'آج', day_tomorrow: 'کل',
    best_line: '{day}، {from} سے {to}', worst_line: 'سب سے خراب: {day}، {from} سے {to}',
    best_pm: 'تقریباً {v} µg/m³',
    best_note: 'گھنٹہ وار ماڈل پیش گوئی سے، صرف دن کے اوقات (صبح 6 سے رات 9 بجے تک)۔ یہ رہنمائی ہے، ضمانت نہیں۔',
    best_none: 'پیش گوئی کا ڈیٹا ابھی کافی نہیں۔',

    fc_title: 'کل: XGBoost پیش گوئی', fc_sub: 'اگلے 24 گھنٹوں کا اوسط PM2.5',
    fc_error: 'عام غلطی ±{v} µg/m³',
    fc_higher: 'اس وقت سے {p}% زیادہ', fc_lower: 'اس وقت سے {p}% کم', fc_same: 'تقریباً اس وقت کے برابر',
    fc_note: 'تجرباتی۔ ماضی کے سینسر ڈیٹا سے سیکھا گیا ہے، اس لیے اسے رہنمائی کے طور پر لیں۔',
    fc_none: 'پیش گوئی ابھی دستیاب نہیں۔',

    chk_title: 'ماڈل اور قریبی سینسر',
    chk_line: '25 کلومیٹر کے اندر {n} سینسر تقریباً {s} µg/m³ بتاتے ہیں۔ ماڈل {m} بتاتا ہے۔',
    chk_lower: 'ماڈل سینسروں سے تقریباً {p}% کم بتا رہا ہے۔',
    chk_higher: 'ماڈل سینسروں سے تقریباً {p}% زیادہ بتا رہا ہے۔',
    chk_close: 'ماڈل اور سینسر قریب قریب متفق ہیں۔',

    tr_trend: 'PM2.5: پچھلے 48 گھنٹے اور اگلے 72 گھنٹے', tr_heat: 'پچھلے 7 دن، گھنٹہ بہ گھنٹہ (اے کیو آئی)',
    tr_past: 'ماضی', tr_model: 'ماڈل پیش گوئی', tr_xgb: 'XGBoost (+24 گھنٹے)', tr_now: 'ابھی', tr_who: 'عالمی ادارۂ صحت کی حد',

    rk_filter: 'شہر تلاش کریں', rk_worst: 'سب سے زیادہ', rk_clean: 'سب سے کم', rk_avg: 'اوسط اے کیو آئی',
    rk_none: 'کوئی شہر نہیں ملا۔', rk_title: 'شہروں کی درجہ بندی (اے کیو آئی)',

    tl_play: 'پچھلے 7 دن چلائیں', tl_pause: 'روکیں', tl_now: 'ابھی', tl_back: 'ابھی پر واپس',
    tl_replay: 'ری پلے (ماڈل کا اندازہ)', tl_forecast: 'پیش گوئی (ماڈل)', tl_live: 'تازہ',
    tl_label: 'وقت', replay_note: 'ری پلے اور پیش گوئی ماڈل کے اندازے ہیں، سینسر ریڈنگ نہیں۔',

    st_title: 'سینسر', st_ago_min: '{m} منٹ پہلے', st_ago_h: '{h} گھنٹے پہلے', sensors_count: '{n} سینسر',

    about_title: 'سموگ واچ پنجاب کے بارے میں',
    about_intro: 'پنجاب، پاکستان کے لیے مفت اور براہِ راست فضائی معیار اور سموگ کا ڈیش بورڈ۔ یہ ہر گھنٹے تازہ ہوتا ہے۔',
    about_sources: 'ڈیٹا کے ذرائع',
    about_src_1: 'فضائی معیار اور موسم کا ماڈل: Open-Meteo (CAMS ENSEMBLE ڈیٹا)۔',
    about_src_2: 'زمینی سینسر: OpenAQ۔ ان میں سے بہت سے کم لاگت کمیونٹی سینسر ہیں، اس لیے معیار مختلف ہو سکتا ہے۔',
    about_src_3: 'آگ کے مقامات: NASA FIRMS (VIIRS سیٹلائٹ)۔',
    about_src_4: 'نقشہ: OpenStreetMap contributors، OpenFreeMap اور CARTO۔',
    about_aqi_t: 'اے کیو آئی کیسے نکالا جاتا ہے',
    about_aqi: 'اے کیو آئی صرف PM2.5 سے، امریکی EPA درجوں کے مطابق نکالا جاتا ہے۔ یہ پنجاب EPA کی سرکاری اصطلاحات سے مختلف ہو سکتا ہے۔',
    about_mm_t: 'ناپا گیا یا ماڈل کا اندازہ',
    about_mm: '"ناپا گیا" کا مطلب ہے کہ قدر شہر کے قریب حقیقی سینسروں کی اوسط ہے۔ "ماڈل کا اندازہ" فضائی ماڈل سے آتا ہے اور سینسر سے مختلف ہو سکتا ہے۔',
    about_smog_t: 'سموگ کے خطرے کا اسکور',
    about_smog: 'یہ اصولوں پر مبنی اسکور ہے جو PM2.5، کمزور ہوا، ہوا کی نیچی تہہ، کم نظر آنے کے فاصلے، نمی اور ہوا کے رخ پر آگ سے بنتا ہے۔ یہ ایک اشاریہ ہے، سائنسی پیمائش نہیں۔',
    about_fc_t: 'XGBoost پیش گوئی',
    about_fc: 'مشین لرننگ ماڈل اگلے 24 گھنٹوں کے اوسط PM2.5 کی پیش گوئی کرتا ہے۔ ہر پیش گوئی کے ساتھ اس کی عام غلطی دکھائی جاتی ہے۔',
    about_health: 'صحت سے متعلق متن عمومی رہنمائی ہے، طبی مشورہ نہیں۔',
    about_close: 'بند کریں',

    loading: 'فضائی معیار کا ڈیٹا لوڈ ہو رہا ہے…', load_fail: 'ڈیٹا لوڈ نہیں ہو سکا', retry: 'دوبارہ کوشش کریں'
  };

  const cities_ur = {
    'Lahore': 'لاہور', 'Faisalabad': 'فیصل آباد', 'Rawalpindi': 'راولپنڈی', 'Islamabad': 'اسلام آباد',
    'Multan': 'ملتان', 'Gujranwala': 'گوجرانوالہ', 'Sargodha': 'سرگودھا', 'Sialkot': 'سیالکوٹ',
    'Bahawalpur': 'بہاولپور', 'Sheikhupura': 'شیخوپورہ', 'Jhang': 'جھنگ', 'Sahiwal': 'ساہیوال',
    'Kasur': 'قصور', 'Okara': 'اوکاڑہ', 'Rahim Yar Khan': 'رحیم یار خان', 'DG Khan': 'ڈیرہ غازی خان',
    'Gujrat': 'گجرات', 'Jhelum': 'جہلم', 'Attock': 'اٹک', 'Chiniot': 'چنیوٹ', 'Mianwali': 'میانوالی',
    'Khushab': 'خوشاب', 'Hafizabad': 'حافظ آباد', 'Mandi Bahauddin': 'منڈی بہاؤالدین',
    'Narowal': 'نارووال', 'Pakpattan': 'پاکپتن', 'Vehari': 'وہاڑی', 'Khanewal': 'خانیوال',
    'Muzaffargarh': 'مظفر گڑھ', 'Bhakkar': 'بھکر', 'Chakwal': 'چکوال', 'Murree': 'مری',
    'Wazirabad': 'وزیرآباد', 'Nankana Sahib': 'ننکانہ صاحب', 'Rajanpur': 'راجن پور', 'Kot Addu': 'کوٹ ادو'
  };

  return { en, ur, cities_ur };
});
