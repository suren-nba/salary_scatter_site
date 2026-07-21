import { state } from "./state.js";
import { teamLogoPath } from "./format.js";

function optionId(team) {
  return `team-option-${team === "ALL" ? "all" : team}`;
}

function getOptions(els) {
  return [...els.teamFilterMenu.querySelectorAll(".team-picker__option")];
}

function setActiveOption(els, option) {
  getOptions(els).forEach((opt) => opt.classList.toggle("team-picker__option--active", opt === option));
  if (option) {
    els.teamFilterButton.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  } else {
    els.teamFilterButton.removeAttribute("aria-activedescendant");
  }
}

export function setTeamPickerOpen(els, open) {
  els.teamFilterButton.setAttribute("aria-expanded", String(open));
  els.teamFilterMenu.hidden = !open;
  if (!open) setActiveOption(els, null);
}

export function moveActiveOption(els, delta) {
  const options = getOptions(els);
  if (!options.length) return;
  const current = options.findIndex((opt) => opt.classList.contains("team-picker__option--active"));
  const selected = options.findIndex((opt) => opt.dataset.team === state.selectedTeam);
  let next = current >= 0 ? current + delta : (selected >= 0 ? selected : 0);
  next = Math.max(0, Math.min(options.length - 1, next));
  setActiveOption(els, options[next]);
}

export function setActiveOptionEdge(els, edge) {
  const options = getOptions(els);
  if (!options.length) return;
  setActiveOption(els, edge === "first" ? options[0] : options[options.length - 1]);
}

export function getActiveOption(els) {
  return getOptions(els).find((opt) => opt.classList.contains("team-picker__option--active")) || null;
}

export function updateTeamPicker(els) {
  const isAll = state.selectedTeam === "ALL";
  els.teamFilterLogo.hidden = isAll;
  els.teamFilterLabel.textContent = isAll ? "全部球队" : state.selectedTeam;
  if (!isAll) {
    els.teamFilterLogo.src = teamLogoPath(state.selectedTeam);
    els.teamFilterLogo.alt = `${state.selectedTeam} 队徽`;
  }
  els.teamFilterMenu.querySelectorAll(".team-picker__option").forEach((option) => {
    option.setAttribute("aria-selected", String(option.dataset.team === state.selectedTeam));
  });
}

function makeTeamOption(team) {
  const option = document.createElement("button");
  option.type = "button";
  option.id = optionId(team);
  option.className = "team-picker__option";
  option.dataset.team = team;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", "false");

  if (team === "ALL") {
    option.classList.add("team-picker__option--all");
  } else {
    const logo = document.createElement("img");
    logo.src = teamLogoPath(team);
    logo.alt = "";
    logo.loading = "lazy";
    option.appendChild(logo);
  }

  const label = document.createElement("span");
  label.textContent = team === "ALL" ? "全部球队" : team;
  option.appendChild(label);
  return option;
}

export function setupTeamPicker(els) {
  els.teamFilterMenu.appendChild(makeTeamOption("ALL"));
  const teams = [...new Set(state.data.map((row) => row.team_abbreviation).filter(Boolean))].sort();
  teams.forEach((team) => els.teamFilterMenu.appendChild(makeTeamOption(team)));
  updateTeamPicker(els);
}
