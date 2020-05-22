import * as Mail from "nodemailer/lib/mailer";

import { toError } from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { getMailerTransporter } from "../utils/email";
import { getSendUserReceiptEmailActivityHandler } from "./handler";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Mailup
const mailupUsername = getRequiredStringEnv("MAILUP_USERNAME");
const mailupSecret = getRequiredStringEnv("MAILUP_SECRET");

// Email data
const mailFrom = getRequiredStringEnv("MAIL_FROM");

const emailDefaults = {
  from: mailFrom
};

export type EmailDefaults = typeof emailDefaults;

const mailerTransporter = getMailerTransporter({
  isProduction,
  ...{ mailupSecret, mailupUsername }
});

const sendMailTask = (mt: Mail) => (
  options: Mail.Options & { html: Mail.Options["html"] }
) => TE.tryCatch(() => mt.sendMail(options), toError);

export type sendMailTaskT = typeof sendMailTask;

const activityFunctionHandler = getSendUserReceiptEmailActivityHandler(
  emailDefaults,
  sendMailTask(mailerTransporter)
);

export default activityFunctionHandler;
