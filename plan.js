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
const DEFAULT_DAYS = ["Legs", "Push", "Pull", "Legs", "Cardio", "Push", "Pull"];

const CARDIO_TYPES = ["Incline walk", "Bike", "Jog", "Intervals (8 x 30s hard / 90s easy)", "Golf", "Long walk", "Other"];
