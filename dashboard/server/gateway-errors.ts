/**
 * Gateway error types — extracted from gateway-adapter.ts for clarity.
 */

export class ControlPlaneGatewayError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(params: { code: string; message: string; details?: unknown }) {
    super(params.message);
    this.name = "ControlPlaneGatewayError";
    this.code = params.code;
    this.details = params.details;
  }
}
