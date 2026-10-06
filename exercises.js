// exercises.js — the exercise list for the "+" workout flow.
// Each row is [name, muscle group, equipment]. Add your own rows here, or use
// "Custom exercise" in the app (those are saved in localStorage instead).
// Names that match the Push/Pull/Legs plan (e.g. "Bench press") share one chart.

const MUSCLES = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes", "Core"];
const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Other"];

const EXERCISES = [
  // Chest
  ["Bench press", "Chest", "Barbell"],
  ["Incline bench press", "Chest", "Barbell"],
  ["Dumbbell bench press", "Chest", "Dumbbell"],
  ["Incline dumbbell press", "Chest", "Dumbbell"],
  ["Dumbbell fly", "Chest", "Dumbbell"],
  ["Pec fly machine", "Chest", "Machine"],
  ["Chest press machine", "Chest", "Machine"],
  ["Cable fly", "Chest", "Cable"],
  ["Push-ups", "Chest", "Bodyweight"],
  ["Chest dips", "Chest", "Bodyweight"],
  // Back
  ["Pull-ups", "Back", "Bodyweight"],
  ["Chin-ups", "Back", "Bodyweight"],
  ["Lat pulldown", "Back", "Cable"],
  ["Straight-arm pulldown", "Back", "Cable"],
  ["Cable row", "Back", "Cable"],
  ["Seated cable row", "Back", "Cable"],
  ["Barbell row", "Back", "Barbell"],
  ["T-bar row", "Back", "Barbell"],
  ["Dumbbell row", "Back", "Dumbbell"],
  ["Seated row machine", "Back", "Machine"],
  ["Chest-supported row", "Back", "Machine"],
  ["Back extension", "Back", "Bodyweight"],
  // Shoulders
  ["Shoulder press", "Shoulders", "Dumbbell"],
  ["Barbell shoulder press", "Shoulders", "Barbell"],
  ["Arnold press", "Shoulders", "Dumbbell"],
  ["Lateral raises", "Shoulders", "Dumbbell"],
  ["Cable lateral raise", "Shoulders", "Cable"],
  ["Front raises", "Shoulders", "Dumbbell"],
  ["Rear delt fly", "Shoulders", "Machine"],
  ["Face pulls", "Shoulders", "Cable"],
  ["Shrugs", "Shoulders", "Dumbbell"],
  // Arms
  ["Curls", "Arms", "Dumbbell"],
  ["Hammer curls", "Arms", "Dumbbell"],
  ["Barbell curl", "Arms", "Barbell"],
  ["Preacher curl", "Arms", "Barbell"],
  ["Cable curl", "Arms", "Cable"],
  ["Triceps pushdowns", "Arms", "Cable"],
  ["Overhead triceps extension", "Arms", "Dumbbell"],
  ["Skull crushers", "Arms", "Barbell"],
  ["Close-grip bench press", "Arms", "Barbell"],
  ["Bench dips", "Arms", "Bodyweight"],
  // Legs
  ["Squat", "Legs", "Barbell"],
  ["Front squat", "Legs", "Barbell"],
  ["Goblet squat", "Legs", "Dumbbell"],
  ["Hack squat", "Legs", "Machine"],
  ["Leg press", "Legs", "Machine"],
  ["Romanian deadlift", "Legs", "Barbell"],
  ["Leg curl", "Legs", "Machine"],
  ["Leg extension", "Legs", "Machine"],
  ["Lunges", "Legs", "Dumbbell"],
  ["Bulgarian split squat", "Legs", "Dumbbell"],
  ["Step-ups", "Legs", "Dumbbell"],
  ["Calf raises", "Legs", "Machine"],
  ["Seated calf raise", "Legs", "Machine"],
  // Glutes
  ["Hip thrust", "Glutes", "Barbell"],
  ["Dumbbell hip thrust", "Glutes", "Dumbbell"],
  ["Glute bridge", "Glutes", "Bodyweight"],
  ["Sumo deadlift", "Glutes", "Barbell"],
  ["Cable kickback", "Glutes", "Cable"],
  ["Glute kickback machine", "Glutes", "Machine"],
  ["Hip abduction machine", "Glutes", "Machine"],
  // Core
  ["Plank", "Core", "Bodyweight"],
  ["Side plank", "Core", "Bodyweight"],
  ["Hanging leg raises", "Core", "Bodyweight"],
  ["Crunches", "Core", "Bodyweight"],
  ["Bicycle crunch", "Core", "Bodyweight"],
  ["Dead bug", "Core", "Bodyweight"],
  ["Cable crunch", "Core", "Cable"],
  ["Pallof press", "Core", "Cable"],
  ["Russian twist", "Core", "Dumbbell"],
  ["Ab wheel", "Core", "Other"],
].map(([name, muscle, equipment]) => ({ name, muscle, equipment }));

// Built-in list + the ones you added, sorted A-Z
function allExercises() {
  return EXERCISES.concat(data.customExercises).sort((a, b) => a.name.localeCompare(b.name));
}
