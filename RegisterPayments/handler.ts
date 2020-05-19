import { Context } from "@azure/functions";
import * as express from "express";
import { Response } from "express";
import { sequenceS } from "fp-ts/lib/Apply";
import { Either, either, fromOption, right } from "fp-ts/lib/Either";
import { fromNullable, Option } from "fp-ts/lib/Option";
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
  DatiPagamento,
  IndirizzoBeneficiario,
  SoggettoPagatore
} from "../types/rtParser";
import { IBlobStorageService } from "../utils/blobStorage";
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

const RT_NAMESPACE = "http://www.digitpa.gov.it/schemas/2011/Pagamenti/";

/**
 * Get the text content of an element nested inside the provided Element.
 * Return an Option<string>
 */
function getElementTextContent(
  element: Element,
  fieldName: string
): Option<string> {
  return fromNullable(
    element.getElementsByTagNameNS(RT_NAMESPACE, fieldName).item(0)
  )
    .orElse(() =>
      // Negative RT haven't namespace on elements
      fromNullable(element.getElementsByTagName(fieldName).item(0))
    )
    .mapNullable(e => e.textContent?.trim());
}

/**
 * Get the text content of an element nested inside the provided Element.
 * Returns an Either<Error, string>
 */
function getElementTextContentEither(
  element: Element,
  fieldName: string
): Either<Error, string> {
  return fromOption(new Error(`Missing field '${fieldName}'`))(
    getElementTextContent(element, fieldName)
  );
}

/**
 * Get an Element inside a Document.
 * Returns Option<Element>
 */
function getElementFromXmlDocument(
  xmlDocument: Document,
  elementName: string
): Option<Element> {
  return fromNullable(
    xmlDocument.getElementsByTagNameNS(RT_NAMESPACE, elementName).item(0)
  ).orElse(() =>
    fromNullable(xmlDocument.getElementsByTagName(elementName).item(0))
  );
}

/**
 * Parse datiPagamento fields values from an XML Document
 */
function parseDatiPagamento(
  xmlDocument: Document
): Either<Error, DatiPagamento> {
  return fromOption(new Error("Missing field 'datiPagamento'"))(
    getElementFromXmlDocument(xmlDocument, "datiPagamento")
  )
    .chain(datiPagamento =>
      getElementTextContentEither(
        datiPagamento,
        "identificativoUnivocoVersamento"
      ).map(_ => ({
        data: { identificativoUnivocoVersamento: _ },
        elements: {
          datiPagamento
        }
      }))
    )
    .chain(_ =>
      getElementTextContentEither(
        _.elements.datiPagamento,
        "importoTotalePagato"
      ).map(importoTotalePagato => ({
        ..._,
        data: { ..._.data, importoTotalePagato }
      }))
    )
    .chain(_ =>
      fromOption(new Error("Missing field 'datiSingoloPagamento'"))(
        fromNullable(
          _.elements.datiPagamento
            .getElementsByTagNameNS(RT_NAMESPACE, "datiSingoloPagamento")
            .item(0)
        )
          .orElse(() =>
            fromNullable(
              _.elements.datiPagamento
                .getElementsByTagName("datiSingoloPagamento")
                .item(0)
            )
          )
          .chain(datiSingoloPagamento =>
            getElementTextContent(
              datiSingoloPagamento,
              "singoloImportoPagato"
            ).map(singoloImportoPagato => ({
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
          getElementTextContentEither(
            _1.elements.datiSingoloPagamento,
            "dataEsitoSingoloPagamento"
          ).map(dataEsitoSingoloPagamento => ({
            data: {
              ..._1.data,
              dataEsitoSingoloPagamento
            },
            elements: _1.elements
          }))
        )
        .chain(_1 =>
          getElementTextContentEither(
            _1.elements.datiSingoloPagamento,
            "identificativoUnivocoRiscossione"
          ).map(identificativoUnivocoRiscossione => ({
            data: {
              ..._1.data,
              identificativoUnivocoRiscossione
            },
            elements: _1.elements
          }))
        )
        .chain(_1 =>
          getElementTextContentEither(
            _1.elements.datiSingoloPagamento,
            "causaleVersamento"
          ).map(causaleVersamento => ({
            data: { ..._1.data, causaleVersamento },
            elements: _1.elements
          }))
        )
        .chain(_1 =>
          getElementTextContentEither(
            _1.elements.datiSingoloPagamento,
            "datiSpecificiRiscossione"
          ).map(datiSpecificiRiscossione => ({
            data: {
              ..._1.data,
              datiSpecificiRiscossione
            },
            elements: _1.elements
          }))
        )
        .chain(_1 =>
          getElementTextContentEither(
            _1.elements.datiSingoloPagamento,
            "commissioniApplicatePSP"
          ).fold(
            () =>
              right({
                data: {
                  ..._1.data,
                  commissioniApplicatePSP: "0.00"
                },
                elements: _1.elements
              }),
            commissioniApplicatePSP =>
              right({
                data: {
                  ..._1.data,
                  commissioniApplicatePSP
                },
                elements: _1.elements
              })
          )
        )
        .chain(_1 =>
          getElementTextContentEither(
            _.elements.datiPagamento,
            "codiceEsitoPagamento"
          ).map(codiceEsitoPagamento => ({
            data: {
              ..._1.data,
              codiceEsitoPagamento
            },
            elements: _1.elements
          }))
        )
    )
    .chain(_ =>
      DatiPagamento.decode(_.data).mapLeft(
        err => new Error(err.map(_1 => _1.message).join("/"))
      )
    );
}

/**
 * Parse indirizzoBeneficiario field value from an XML Document
 */
function parseIndirizzoBeneficiario(
  xmlDocument: Document
): Either<Error, IndirizzoBeneficiario> {
  return fromOption(new Error("Missing field 'indirizzoBeneficiario'"))(
    getElementFromXmlDocument(
      xmlDocument,
      "indirizzoBeneficiario"
    ).mapNullable(e => e.textContent?.trim())
  ).chain(indirizzoBeneficiario =>
    IndirizzoBeneficiario.decode({ indirizzoBeneficiario }).mapLeft(
      err => new Error(err.map(_ => _.message).join("/"))
    )
  );
}

/**
 * Parse soggettoPagatore fields values from an XML Document
 */
function parseSoggettoPagatore(
  xmlDocument: Document
): Either<Error, SoggettoPagatore> {
  return fromOption(new Error("Invalid soggettoPagatore"))(
    getElementFromXmlDocument(xmlDocument, "soggettoPagatore").chain(
      soggettoPagatore =>
        getElementTextContent(soggettoPagatore, "anagraficaPagatore")
          .map(anagraficaPagatore => ({
            data: { anagraficaPagatore },
            elements: { soggettoPagatore }
          }))
          .chain(_ =>
            getElementTextContent(
              _.elements.soggettoPagatore,
              "codiceIdentificativoUnivoco"
            ).map(codiceIdentificativoUnivoco => ({
              data: {
                ..._.data,
                codiceIdentificativoUnivoco
              },
              elements: _.elements
            }))
          )
          .chain(_ =>
            getElementTextContent(
              _.elements.soggettoPagatore,
              "e-mailPagatore"
            ).map(emailPagatore => ({
              data: {
                ..._.data,
                emailPagatore
              },
              elements: _.elements
            }))
          )
    )
  ).chain(_ =>
    SoggettoPagatore.decode(_.data).mapLeft(
      err => new Error(err.map(_1 => _1.message).join("/"))
    )
  );
}

/**
 * Parse a base64 encoded RT and store it inside a Blob Storage
 */
export function RegisterPaymentHandler(
  blobStorageService: IBlobStorageService
): IRegisterPaymentHandler {
  return async (context, __, registerPaymentNotify) => {
    if (registerPaymentNotify.receiptXML) {
      const decodedRTXML = Buffer.from(
        registerPaymentNotify.receiptXML,
        "base64"
      ).toString("ascii");
      const xmlDocument = new DOMParser().parseFromString(
        decodedRTXML,
        "text/xml"
      );
      return await sequenceS(either)({
        datiPagamento: parseDatiPagamento(xmlDocument),
        indirizzoBeneficiario: parseIndirizzoBeneficiario(xmlDocument),
        soggettoPagatore: parseSoggettoPagatore(xmlDocument)
      })
        .map<
          Promise<IResponseSuccessJson<SuccessResponse> | IResponsePaymentError>
        >(async _ => {
          // TODO: Handle exceptions for saveRTToBlobStorage
          const blobUpdateRespone = await blobStorageService.save(
            `${_.datiPagamento.dataEsitoSingoloPagamento}-${_.datiPagamento.identificativoUnivocoVersamento}.xml`,
            decodedRTXML
          );
          context.log.info(
            `RegisterPayment|INFO|Save RT into blob storage. requestId: ${blobUpdateRespone.requestId}`
          );
          return ResponseSuccessJson({ result: SuccessResultEnum.OK });
        })
        .mapLeft(_ => {
          context.log.error(`RegisterPayment|ERROR|Invalid RT: ${_}`);
          return _;
        })
        .getOrElse(
          Promise.resolve(
            ResponsePaymentError("Error on register payment", "Invalid RT")
          )
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
  basicAuthParams: IBasicAuthParams,
  blobStorageService: IBlobStorageService
): express.RequestHandler {
  const handler = RegisterPaymentHandler(blobStorageService);

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
