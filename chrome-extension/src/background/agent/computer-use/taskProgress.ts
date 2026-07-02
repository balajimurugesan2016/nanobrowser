export interface CheckboxState {
  index: number;
  checked: boolean;
}

export interface ComputerUseSnapshot {
  screenshotCount: number;
  recentActions: string[];
}

export interface TaskProgressEvaluation {
  summaryLines: string[];
  likelyComplete: boolean;
}

export function evaluateNumberedTaskProgress(
  task: string,
  url: string,
  snapshot: ComputerUseSnapshot,
  checkboxes: CheckboxState[],
): TaskProgressEvaluation {
  const lowerTask = task.toLowerCase();
  const onHeroku = url.includes('the-internet.herokuapp.com');
  const onCheckboxes = url.includes('/checkboxes');
  const wantsCheckboxes = lowerTask.includes('checkbox');
  const wantsFirstCheckbox = /first checkbox/.test(lowerTask);
  const firstChecked = checkboxes.find(box => box.index === 1)?.checked ?? false;
  const screenshotCount = snapshot.screenshotCount;

  const summaryLines = [
    `Screenshots captured in side panel: ${screenshotCount}`,
    `On the-internet.herokuapp.com: ${onHeroku ? 'yes' : 'no'}`,
    `On /checkboxes page: ${onCheckboxes ? 'yes' : 'no'}`,
    `Recent navigator actions: ${snapshot.recentActions.length > 0 ? snapshot.recentActions.join(' | ') : 'none yet'}`,
  ];

  if (wantsCheckboxes && checkboxes.length > 0) {
    summaryLines.push(
      `Checkbox states: ${checkboxes.map(box => `#${box.index} ${box.checked ? 'checked' : 'unchecked'}`).join(', ')}`,
    );
  }

  const likelyComplete =
    onHeroku &&
    screenshotCount >= 1 &&
    (!wantsCheckboxes || onCheckboxes) &&
    (!wantsCheckboxes || screenshotCount >= 2) &&
    (!wantsFirstCheckbox || firstChecked) &&
    (!wantsFirstCheckbox || screenshotCount >= 3);

  if (likelyComplete) {
    summaryLines.push('All numbered steps in the user task appear satisfied. Set done=true with a short final_answer.');
  }

  return { summaryLines, likelyComplete };
}
