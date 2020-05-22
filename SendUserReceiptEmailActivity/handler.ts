import * as t from "io-ts";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { left, right } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import { EmailDefaults, sendMailTaskT } from ".";
import { RTData } from "../types/rtParser";

// Activity input
export const ActivityInput = RTData;
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const getReceiptEmailText = (rtData: ActivityInput) =>
  `Grazie ${rtData.soggettoPagatore.anagraficaPagatore}:
Questa è la ricevuta della tua donazione di ${rtData.datiPagamento.singoloImportoPagato} a ${rtData.enteBeneficiario.denomUnitOperBeneficiario}
per la campagna ${rtData.datiPagamento.causaleVersamento}.

Invita i tuoi amici a sostenere la campagna condividendo il link ${rtData.enteBeneficiario.indirizzoBeneficiario}

Di seguito trovi i dati della tua donazione che possono essere utili a fini fiscali.

Donatore: ${rtData.soggettoPagatore.anagraficaPagatore}
Codice fiscale del donatore: ${rtData.soggettoPagatore.codiceIdentificativoUnivoco}
Beneficiario: ${rtData.enteBeneficiario.denomUnitOperBeneficiario}
Codice fiscale beneficiario: ${rtData.dominio.identificativoDominio}
Data esecuzione donazione: ${rtData.datiPagamento.dataEsitoSingoloPagamento}
Causale della donazione: ${rtData.datiPagamento.causaleVersamento}
Importo della donazione: ${rtData.datiPagamento.singoloImportoPagato}
Commissione per la transazione: ${rtData.datiPagamento.commissioniApplicatePSP}
Importo totale della transazione: ${rtData.datiPagamento.importoTotalePagato}

Questa ricevuta riguarda una donazione seguita online tramite strimenti di pagamento traccibili che ti permetono di usufruire dei relativi benefici fiscali.
Conserva la presente ricevuta per le tue detrazioni/deduzioni.`;

export const getReceiptEmailHtml = (subject: string, rtData: ActivityInput) => `
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>${subject}</title>
        </head>
        <body>
          <h1>Grazie ${rtData.soggettoPagatore.anagraficaPagatore}</h1>
          <p>Questa è la ricevuta della tua donazione di ${rtData.datiPagamento.singoloImportoPagato} a ${rtData.enteBeneficiario.denomUnitOperBeneficiario}
          per la campagna ${rtData.datiPagamento.causaleVersamento}.</p>
          
          <p>Invita i tuoi amici a sostenere la campagna condividendo il link ${rtData.enteBeneficiario.indirizzoBeneficiario}</p>
          
          <p>Di seguito trovi i dati della tua donazione che possono essere utili a fini fiscali.</p>
          
          <p>Donatore: ${rtData.soggettoPagatore.anagraficaPagatore}</p>
          <p>Codice fiscale del donatore: ${rtData.soggettoPagatore.codiceIdentificativoUnivoco}</p>
          <p>Beneficiario: ${rtData.enteBeneficiario.denomUnitOperBeneficiario}</p>
          <p>Codice fiscale beneficiario: ${rtData.dominio.identificativoDominio}</p>
          <p>Data esecuzione donazione: ${rtData.datiPagamento.dataEsitoSingoloPagamento}</p>
          <p>Causale della donazione: ${rtData.datiPagamento.causaleVersamento}</p>
          <p>Importo della donazione: ${rtData.datiPagamento.singoloImportoPagato}</p>
          <p>Commissione per la transazione: ${rtData.datiPagamento.commissioniApplicatePSP}</p>
          <p>Importo totale della transazione: ${rtData.datiPagamento.importoTotalePagato}</p>
          
          <p>Questa ricevuta riguarda una donazione seguita online tramite strimenti di pagamento traccibili che ti permetono di usufruire dei relativi benefici fiscali.
          Conserva la presente ricevuta per le tue detrazioni/deduzioni.</p>
        </body>
      </html>`;

const failActivity = (context: Context, logPrefix: string) => (
  errorMessage: string,
  errorDetails?: string
) => {
  const details = errorDetails ? `|ERROR_DETAILS=${errorDetails}` : ``;
  context.log.error(`${logPrefix}|${errorMessage}${details}`);
  return ActivityResultFailure.encode({
    kind: "FAILURE",
    reason: errorMessage
  });
};

const success = () =>
  ActivityResultSuccess.encode({
    kind: "SUCCESS"
  });

export const getSendUserReceiptEmailActivityHandler = (
  emailDefaults: EmailDefaults,
  sendMail: ReturnType<sendMailTaskT>,
  logPrefix = "SendUserReceiptEmail"
) => async (context: Context, input: unknown) => {
  const failure = failActivity(context, logPrefix);
  return fromEither(ActivityInput.decode(input))
    .mapLeft(errs =>
      failure("Error decoding activity input", readableReport(errs))
    )
    .chain(rtData => {
      const subject = `IO Dono - Ricevuta di pagamento per donazione`;
      const emailText = getReceiptEmailText(rtData);
      const emailHtml = getReceiptEmailHtml(subject, rtData);
      return sendMail({
        from: emailDefaults.from,
        html: emailHtml,
        subject,
        text: emailText,
        to: rtData.soggettoPagatore.emailPagatore
      }).foldTaskEither<ActivityResultFailure, ActivityResultSuccess>(
        err => fromEither(left(failure("Error sending email", err.message))),
        _ => fromEither(right(success()))
      );
    })
    .run();
};
