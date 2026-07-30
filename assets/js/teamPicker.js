import { state } from "./state.js?v=20260728-6";
import {
  teamDisplayName,
  teamHasLogo,
  teamLogoPath,
} from "./format.js?v=20260728-6";

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
  if (open) {
    els.teamFilterMenu.querySelectorAll("img[data-src]").forEach((logo) => {
      logo.src = logo.dataset.src;
      logo.removeAttribute("data-src");
    });
  }
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
  const hasLogo = teamHasLogo(state.selectedTeam);
  els.teamFilterLogo.hidden = !hasLogo;
  els.teamFilterLabel.textContent = teamDisplayName(state.selectedTeam);
  if (hasLogo) {
    els.teamFilterLogo.src = teamLogoPath(state.selectedTeam);
    els.teamFilterLogo.alt = `${state.selectedTeam} 队徽`;
  } else {
    els.teamFilterLogo.removeAttribute("src");
    els.teamFilterLogo.alt = "";
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

  if (teamHasLogo(team)) {
    const logo = document.createElement("img");
    logo.dataset.src = teamLogoPath(team);
    logo.alt = "";
    logo.width = 28;
    logo.height = 28;
    logo.loading = "lazy";
    logo.decoding = "async";
    option.appendChild(logo);
  } else {
    option.classList.add("team-picker__option--no-logo");
  }

  const label = document.createElement("span");
  label.textContent = teamDisplayName(team);
  option.appendChild(label);
  return option;
}

export function setupTeamPicker(els) {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(makeTeamOption("ALL"));
  const availableTeams = new Set(state.data.map((row) => row.team_abbreviation).filter(Boolean));
  if (availableTeams.has("NA")) fragment.appendChild(makeTeamOption("NA"));
  const teams = [...availableTeams].filter((team) => team !== "NA").sort();
  teams.forEach((team) => fragment.appendChild(makeTeamOption(team)));
  els.teamFilterMenu.replaceChildren(fragment);
  updateTeamPicker(els);
}
