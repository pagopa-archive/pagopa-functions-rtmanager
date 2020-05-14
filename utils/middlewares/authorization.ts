import { fromPredicate, left, right } from "fp-ts/lib/Either";
import { IRequestMiddleware } from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorForbiddenAnonymousUser,
  IResponseErrorForbiddenNotAuthorized,
  ResponseErrorForbiddenAnonymousUser,
  ResponseErrorForbiddenNotAuthorized
} from "italia-ts-commons/lib/responses";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export interface IBasicAuthParams {
  readonly clientId: NonEmptyString;
  readonly secret: NonEmptyString;
}

export interface IAzureBasicAuth {
  readonly kind: "IAzureBasicAuth";
  readonly clientId: NonEmptyString;
}

const BASIC_AUTH_PREFIX = "Basic ";

type AzureBasicAuthMiddlewareErrorResponses =
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorForbiddenAnonymousUser;

export function BasicAuthMiddleware(
  authParams: IBasicAuthParams
): IRequestMiddleware<
  | "IResponseErrorForbiddenAnonymousUser"
  | "IResponseErrorForbiddenNotAuthorized",
  IAzureBasicAuth
> {
  return request =>
    new Promise(resolve => {
      NonEmptyString.decode(request.header("Authorization"))
        .mapLeft(errors => new Error(errors.join("/")))
        .chain(
          fromPredicate(
            _ => _.startsWith(BASIC_AUTH_PREFIX),
            () => new Error("Invalid Authorization Header")
          )
        )
        .mapLeft(_ =>
          // TODO: Log error
          resolve(
            left<AzureBasicAuthMiddlewareErrorResponses, IAzureBasicAuth>(
              ResponseErrorForbiddenAnonymousUser
            )
          )
        )
        .map(_ => _.split(BASIC_AUTH_PREFIX)[1])
        .map(_ => {
          const receivedAuthParams = Buffer.from(_, "base64")
            .toString("ascii")
            .split(":");
          if (
            receivedAuthParams[0] !== authParams.clientId ||
            receivedAuthParams[1] !== authParams.secret
          ) {
            resolve(
              left<AzureBasicAuthMiddlewareErrorResponses, IAzureBasicAuth>(
                ResponseErrorForbiddenNotAuthorized
              )
            );
          } else {
            const authInfo: IAzureBasicAuth = {
              clientId: authParams.clientId,
              kind: "IAzureBasicAuth"
            };
            resolve(right(authInfo));
          }
        });
    });
}
