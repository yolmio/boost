import { Authorization } from "../modelTypes.js";
import { if_, throwError } from "../procHelpers.js";
import { model } from "../singleton.js";

export function currentUserIsAuthorized(auth: Authorization) {
  return model.database.userIsAuthorized("current_user()", auth);
}

export function currentUserIsNotAuthorized(auth: Authorization) {
  return "not " + currentUserIsAuthorized(auth);
}

export function expectCurrentUserAuthorized(auth?: Authorization) {
  if (auth) {
    return if_(currentUserIsNotAuthorized(auth), throwError("'Unauthorized'"));
  }
}
