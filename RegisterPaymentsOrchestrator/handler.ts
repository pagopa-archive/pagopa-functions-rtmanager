import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { RTData } from "../types/rtParser";

/**
 * Carries information about created or updated user data processing.
 */
export const OrchestratorInput = RTData;
export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const handler = function*(
  context: IOrchestrationFunctionContext
  // tslint:disable-next-line: no-any
): Generator<unknown, unknown, any> {
  const logPrefix = `RegisterPaymentsOrchestrator`;

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrRegisterPaymentsOrchestratorInput = OrchestratorInput.decode(
    input
  );

  if (isLeft(errorOrRegisterPaymentsOrchestratorInput)) {
    context.log.error(`${logPrefix}|Error decoding input`);
    context.log.verbose(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrRegisterPaymentsOrchestratorInput.value
      )}`
    );
    return false;
  }

  const registerPaymentsOrchestratorInput =
    errorOrRegisterPaymentsOrchestratorInput.value;

  yield context.df.callActivity(
    "SendUserReceiptEmailActivity",
    registerPaymentsOrchestratorInput
  );

  return true;
};
