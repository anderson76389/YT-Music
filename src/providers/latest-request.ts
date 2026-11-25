/** A new track invalidates and aborts the previous metadata request. */
export class LatestRequest {
  private controller: AbortController | undefined;

  begin(): AbortSignal {
    this.controller?.abort();
    this.controller = new AbortController();
    return this.controller.signal;
  }

  isCurrent(signal: AbortSignal): boolean {
    return this.controller?.signal === signal && !signal.aborted;
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = undefined;
  }
}
