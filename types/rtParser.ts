import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

const CodiceEsitoPagamento = t.union([t.literal("0"), t.literal("1")]);
type CodiceEsitoPagamento = t.TypeOf<typeof CodiceEsitoPagamento>;

export const DatiPagamento = t.exact(
  t.interface({
    identificativoUnivocoVersamento: NonEmptyString,

    importoTotalePagato: NonEmptyString,

    singoloImportoPagato: NonEmptyString,

    dataEsitoSingoloPagamento: NonEmptyString,

    identificativoUnivocoRiscossione: NonEmptyString,

    causaleVersamento: NonEmptyString,

    datiSpecificiRiscossione: NonEmptyString,

    commissioniApplicatePSP: NonEmptyString,

    codiceEsitoPagamento: CodiceEsitoPagamento
  })
);
export type DatiPagamento = t.TypeOf<typeof DatiPagamento>;

export const EnteBeneficiario = t.exact(
  t.interface({
    denomUnitOperBeneficiario: NonEmptyString,
    indirizzoBeneficiario: NonEmptyString
  })
);
export type EnteBeneficiario = t.TypeOf<typeof EnteBeneficiario>;

export const SoggettoPagatore = t.exact(
  t.interface({
    anagraficaPagatore: NonEmptyString,

    emailPagatore: NonEmptyString,

    codiceIdentificativoUnivoco: NonEmptyString
  })
);
export type SoggettoPagatore = t.TypeOf<typeof SoggettoPagatore>;

export const Dominio = t.interface({
  identificativoDominio: NonEmptyString
});
export type Dominio = t.TypeOf<typeof Dominio>;

export const RTData = t.interface({
  datiPagamento: DatiPagamento,
  dominio: Dominio,
  enteBeneficiario: EnteBeneficiario,
  soggettoPagatore: SoggettoPagatore
});
export type RTData = t.TypeOf<typeof RTData>;
