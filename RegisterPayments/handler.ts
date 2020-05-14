import { Context } from "@azure/functions";
import * as express from "express";
import { Response } from "express";
import { fromOption } from "fp-ts/lib/Either";
import { fromNullable, some } from "fp-ts/lib/Option";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponse,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { DOMParser } from "xmldom";
import { ResultEnum as ErrorResultEnum } from "../generated/definitions/ErrorResponse";
import { RegisterPaymentNotify } from "../generated/definitions/RegisterPaymentNotify";
import {
  ResultEnum as SuccessResultEnum,
  SuccessResponse
} from "../generated/definitions/SuccessResponse";
import {
  BasicAuthMiddleware,
  IAzureBasicAuth,
  IBasicAuthParams
} from "../utils/middlewares/authorization";

export interface IResponsePaymentError
  extends IResponse<"IResponsePaymentError"> {}
const ResponsePaymentError = (
  title: string,
  detail: string
): IResponsePaymentError => ({
  apply: (res: Response) =>
    res
      .status(500)
      .set("Content-Type", "application/problem+json")
      .json({ result: ErrorResultEnum.KO }),
  detail: `${title}: ${detail}`,
  kind: "IResponsePaymentError"
});

type IRegisterPaymentHandler = (
  context: Context,
  auth: IAzureBasicAuth,
  registerPaymentNotify: RegisterPaymentNotify
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessJson<SuccessResponse>
  | IResponsePaymentError
  | IResponseErrorValidation
>;

function getElementTextContent(e: Element): string | undefined {
  return e.textContent?.trim();
}

// tslint:disable-next-line: no-big-function
export function RegisterPaymentHandler(): IRegisterPaymentHandler {
  // tslint:disable-next-line: no-big-function
  return async (context, __, registerPaymentNotify) => {
    context.log.verbose(`${JSON.stringify(registerPaymentNotify)}`);
    if (registerPaymentNotify.receiptXML) {
      const decodedRTXML = Buffer.from(
        registerPaymentNotify.receiptXML,
        "base64"
      ).toString("ascii");
      context.log.info(`RT: ${decodedRTXML}`);
      const xmlDocument = new DOMParser().parseFromString(
        decodedRTXML,
        "text/xml"
      );
      return fromOption(new Error("Missing datiPagamento"))(
        fromNullable(xmlDocument.getElementsByTagName("datiPagamento").item(0))
      )
        .chain(datiPagamento =>
          fromOption(new Error("Missing identificativoUnivocoVersamento"))(
            fromNullable(
              datiPagamento
                .getElementsByTagName("identificativoUnivocoVersamento")
                .item(0)
            )
              .mapNullable(getElementTextContent)
              .map(identificativoUnivocoVersamento => ({
                data: { identificativoUnivocoVersamento },
                elements: { datiPagamento }
              }))
          )
        )
        .chain(_ =>
          fromOption(new Error("Missing importoTotalePagato"))(
            fromNullable(
              _.elements.datiPagamento
                .getElementsByTagName("importoTotalePagato")
                .item(0)
            )
              .mapNullable(getElementTextContent)
              .map(importoTotalePagato => ({
                ..._,
                data: { ..._.data, importoTotalePagato }
              }))
          )
        )
        .chain(_ =>
          fromOption(new Error("Missing datiSingoloPagamento"))(
            fromNullable(
              _.elements.datiPagamento
                .getElementsByTagName("datiSingoloPagamento")
                .item(0)
            ).chain(datiSingoloPagamento =>
              fromNullable(
                datiSingoloPagamento
                  .getElementsByTagName("singoloImportoPagato")
                  .item(0)
              )
                .mapNullable(getElementTextContent)
                .map(singoloImportoPagato => ({
                  data: {
                    ..._.data,
                    singoloImportoPagato
                  },
                  elements: {
                    ..._.elements,
                    datiSingoloPagamento
                  }
                }))
            )
          )
            .chain(_1 =>
              fromOption(new Error("Missing dataEsitoSingoloPagamento"))(
                fromNullable(
                  _1.elements.datiSingoloPagamento
                    .getElementsByTagName("dataEsitoSingoloPagamento")
                    .item(0)
                )
                  .mapNullable(getElementTextContent)
                  .map(dataEsitoSingoloPagamento => ({
                    data: {
                      ..._1.data,
                      dataEsitoSingoloPagamento
                    },
                    elements: _1.elements
                  }))
              )
            )
            .chain(_1 =>
              fromOption(new Error("Missing identificativoUnivocoRiscossione"))(
                fromNullable(
                  _1.elements.datiSingoloPagamento
                    .getElementsByTagName("identificativoUnivocoRiscossione")
                    .item(0)
                )
                  .mapNullable(getElementTextContent)
                  .map(identificativoUnivocoRiscossione => ({
                    data: {
                      ..._1.data,
                      identificativoUnivocoRiscossione
                    },
                    elements: _1.elements
                  }))
              )
            )
            .chain(_1 =>
              fromOption(new Error("Missing causaleVersamento"))(
                fromNullable(
                  _1.elements.datiSingoloPagamento
                    .getElementsByTagName("causaleVersamento")
                    .item(0)
                )
                  .mapNullable(getElementTextContent)
                  .map(causaleVersamento => ({
                    data: { ..._1.data, causaleVersamento },
                    elements: _1.elements
                  }))
              )
            )
            .chain(_1 =>
              fromOption(new Error("Missing datiSpecificiRiscossione"))(
                fromNullable(
                  _1.elements.datiSingoloPagamento
                    .getElementsByTagName("datiSpecificiRiscossione")
                    .item(0)
                )
                  .mapNullable(getElementTextContent)
                  .map(datiSpecificiRiscossione => ({
                    data: {
                      ..._1.data,
                      datiSpecificiRiscossione
                    },
                    elements: _1.elements
                  }))
              )
            )
            .chain(_1 =>
              fromOption(new Error("Missing commissioniApplicatePSP"))(
                fromNullable(
                  _1.elements.datiSingoloPagamento
                    .getElementsByTagName("commissioniApplicatePSP")
                    .item(0)
                )
                  .mapNullable(getElementTextContent)
                  .map(commissioniApplicatePSP => ({
                    data: {
                      ..._1.data,
                      commissioniApplicatePSP
                    },
                    elements: _1.elements
                  }))
                  .orElse(() =>
                    some({
                      data: {
                        ..._1.data,
                        commissioniApplicatePSP: "0.00"
                      },
                      elements: _1.elements
                    })
                  )
              )
            )
        )
        .chain(_ =>
          fromOption(new Error("Invalid soggettoPagatore"))(
            fromNullable(
              xmlDocument.getElementsByTagName("soggettoPagatore").item(0)
            ).chain(soggettoPagatore =>
              fromNullable(
                soggettoPagatore
                  .getElementsByTagName("anagraficaPagatore")
                  .item(0)
              )
                .mapNullable(getElementTextContent)
                .map(anagraficaPagatore => ({
                  data: { anagraficaPagatore },
                  elements: { soggettoPagatore }
                }))
                .chain(_1 =>
                  fromNullable(
                    _1.elements.soggettoPagatore
                      .getElementsByTagName("codiceIdentificativoUnivoco")
                      .item(0)
                  )
                    .mapNullable(getElementTextContent)
                    .map(codiceIdentificativoUnivoco => ({
                      data: {
                        ..._1.data,
                        codiceIdentificativoUnivoco
                      },
                      elements: _1.elements
                    }))
                )
                .chain(_1 =>
                  fromNullable(
                    _1.elements.soggettoPagatore
                      .getElementsByTagName("e-mailPagatore")
                      .item(0)
                  )
                    .mapNullable(getElementTextContent)
                    .map(emailPagatore => ({
                      data: {
                        ..._1.data,
                        emailPagatore
                      },
                      elements: _1.elements
                    }))
                )
                .map(_1 => ({ ..._1.data, ..._.data }))
            )
          )
        )
        .chain(_ =>
          fromOption(new Error("Missing indirizzoBeneficiario"))(
            fromNullable(
              xmlDocument.getElementsByTagName("indirizzoBeneficiario").item(0)
            )
              .mapNullable(getElementTextContent)
              .map(indirizzoBeneficiario => ({
                ..._,
                indirizzoBeneficiario
              }))
          )
        )
        .map<IResponseSuccessJson<SuccessResponse> | IResponsePaymentError>(
          _ => {
            // tslint:disable-next-line: no-object-mutation
            context.bindings.rtDocument = decodedRTXML;
            // tslint:disable-next-line: no-object-mutation
            context.bindings.iuv = _.identificativoUnivocoVersamento;
            return ResponseSuccessJson({ result: SuccessResultEnum.OK });
          }
        )
        .mapLeft(_ => {
          context.log.error(`Invalid RT: ${_}`);
          return _;
        })
        .getOrElse(
          ResponsePaymentError("Error on register payment", "Invalid RT")
        );
    } else {
      return ResponsePaymentError(
        "Error on register payment",
        "Missing RT in request"
      );
    }
  };
}

export function RegisterPayment(
  basicAuthParams: IBasicAuthParams
): express.RequestHandler {
  const handler = RegisterPaymentHandler();

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    // Check Basic Auth inside request header
    BasicAuthMiddleware(basicAuthParams),
    // Extract the body payload from the request
    RequiredBodyPayloadMiddleware(RegisterPaymentNotify)
  );

  return wrapRequestHandler(middlewaresWrap(handler));
}
