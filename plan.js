// plan.js — the workout plan. Edit this file to change exercises.
//
// options : names you can pick from (first one is the default)
// sets    : how many sets
// min/max : rep range. Every range stays inside 6-15 reps.
// failure : the LAST set is taken to failure (gets a FAILURE tag)
// small   : small lift, so progress adds 2.5 lb instead of 5 lb

const PLAN = {
  Push: [
    { options: ["Bench press"],          sets: 4, min: 6,  max: 8 },
    { options: ["Incline dumbbell press"], sets: 3, min: 8,  max: 10 },
    { options: ["Shoulder press"],       sets: 3, min: 8,  max: 10 },
    { options: ["Lateral raises"],       sets: 3, min: 12, max: 15, failure: true, small: true },
    { options: ["Triceps pushdowns"],    sets: 3, min: 10, max: 12, failure: true, small: true },
    { options: ["Pec fly machine"],      sets: 2, min: 12, max: 12, failure: true, small: true },
  ],
  Pull: [
    { options: ["Pull-ups", "Lat pulldown"],   sets: 4, min: 6,  max: 10 },
    { options: ["Barbell row", "Cable row"],   sets: 3, min: 8,  max: 10 },
    { options: ["Dumbbell row"],               sets: 3, min: 10, max: 10 },
    { options: ["Face pulls"],                 sets: 3, min: 12, max: 15, small: true },
    { options: ["Curls"],                      sets: 3, min: 10, max: 12, failure: true, small: true },
    { options: ["Hammer curls"],               sets: 2, min: 12, max: 12, failure: true, small: true },
  ],
  Legs: [
    { options: ["Squat"],            sets: 4, min: 6,  max: 8 },
    { options: ["Romanian deadlift"], sets: 3, min: 8,  max: 10 },
    { options: ["Leg press"],        sets: 3, min: 10, max: 12 },
    { options: ["Leg curl"],         sets: 3, min: 10, max: 12, failure: true },
    { options: ["Calf raises"],      sets: 4, min: 12, max: 15, failure: true },
    { options: ["Hanging leg raises", "Plank"], sets: 3, min: 8, max: 15 },
  ],
  Cardio: [],
  Rest: [],
};

// Exercises logged in seconds instead of reps (no rep-range warning, no progress tip)
const TIMED = ["Plank", "Side plank"];

// Which day to show by default. getDay(): Sunday = 0 ... Saturday = 6
const DEFAULT_DAYS = ["Rest", "Push", "Pull", "Legs", "Cardio", "Push", "Rest"]; // Sat and Sun are rest days

const CARDIO_TYPES = ["Incline walk", "Bike", "Jog", "Intervals (8 x 30s hard / 90s easy)", "Golf", "Long walk", "Other"];

// Days for the preset day tags (label, getDay() number), Monday first
const WEEK = [["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0]];

// Starter presets, added once on first launch if you have no presets yet.
// Exercise rows: [name, sets, min reps, max reps] (null reps = timed, like Plank)
const DEFAULT_PRESETS = [
  { name: "Push", days: [1, 5], exercises: [
    ["Bench press", 4, 6, 8], ["Incline dumbbell press", 3, 8, 10], ["Shoulder press", 3, 8, 10],
    ["Lateral raises", 3, 12, 15], ["Triceps pushdowns", 3, 10, 12], ["Pec fly machine", 2, 12, 12] ] },
  { name: "Pull", days: [2], exercises: [
    ["Lat pulldown", 4, 6, 10], ["Seated cable row", 3, 8, 10], ["Dumbbell row", 3, 10, 10],
    ["Face pulls", 3, 12, 15], ["Curls", 3, 10, 12], ["Hammer curls", 2, 12, 12] ] },
  { name: "Legs", days: [3], exercises: [
    ["Squat", 4, 6, 8], ["Romanian deadlift", 3, 8, 10], ["Leg press", 3, 10, 12],
    ["Leg curl", 3, 10, 12], ["Calf raises", 4, 12, 15], ["Plank", 3, null, null] ] },
];

// Apple Health workout types for "Send to Apple Health". Names match Apple's own.
const WEIGHTS_HEALTH_TYPE = "Traditional Strength Training";
const HEALTH_TYPES = {
  "Incline walk": "Walking",
  "Bike": "Cycling",
  "Jog": "Running",
  "Intervals (8 x 30s hard / 90s easy)": "High Intensity Interval Training",
  "Golf": null, // null = never sent: 18Birdies already logs golf in Apple Fitness
  "Long walk": "Walking",
  "Other": "Other",
};
function healthTypeFor(cardioType) {
  return cardioType in HEALTH_TYPES ? HEALTH_TYPES[cardioType] : "Other";
}
