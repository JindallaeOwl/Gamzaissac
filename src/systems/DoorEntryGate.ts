export class DoorEntryGate {
  private open = false;
  private waitingForPlayerExit = false;

  setOpen(open: boolean, requireFreshEntry = false): void {
    const justOpened = open && !this.open;
    this.open = open;

    if (!open) {
      this.waitingForPlayerExit = false;
    } else if (justOpened && requireFreshEntry) {
      this.waitingForPlayerExit = true;
    }
  }

  updatePlayerOverlap(isOverlapping: boolean): void {
    if (this.open && this.waitingForPlayerExit && !isOverlapping) {
      this.waitingForPlayerExit = false;
    }
  }

  canEnter(): boolean {
    return this.open && !this.waitingForPlayerExit;
  }
}
