// Shared color helpers (globals)
function gradeColor(grade) {
  if (grade == null) return "#2a313c";
  const g = Math.max(0, Math.min(10, grade));
  const hue = 8 + g * 11;
  const sat = 65;
  const light = 28 + g * 3.5;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function textOnGrade(grade) {
  if (grade == null) return "#777";
  return grade >= 5 ? "#0a0a0a" : "#fafafa";
}
