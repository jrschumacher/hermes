import Controller from "@ember/controller";
import { inject as service } from "@ember/service";
import AuthenticatedUserService from "hermes/services/authenticated-user";

export default class AuthenticatedMyController extends Controller {
  @service declare authenticatedUser: AuthenticatedUserService

  queryParams = ["docType", "owners", "page", "product", "sortBy", "status"];
  docType = [];
  page = 1;
  owners = [];
  product = [];
  sortBy = "dateDesc";
  status = [];
}
