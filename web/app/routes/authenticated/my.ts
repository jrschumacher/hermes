import Route from "@ember/routing/route";
import RSVP from "rsvp";
import { inject as service } from "@ember/service";
import ConfigService from "hermes/services/config";
import { DocumentsRouteParams } from "hermes/types/document-routes";
import { task } from "ember-concurrency";
import AlgoliaService, {
  AlgoliaFacetsObject,
  AlgoliaSearchParams,
  FACET_NAMES,
  HITS_PER_PAGE,
  MAX_VALUES_PER_FACET,
} from "hermes/services/algolia";
import FetchService from "hermes/services/fetch";
import AuthenticatedUserService from "hermes/services/authenticated-user";
import { HermesDocument } from "hermes/types/document";
import { SearchResponse } from "instantsearch.js";

interface DraftResponseJSON {
  facets: AlgoliaFacetsObject;
  Hits: HermesDocument[];
  params: string;
  page: number;
}

export default class AuthenticatedMyRoute extends Route {
  @service declare algolia: AlgoliaService;
  @service("fetch") declare fetchSvc: FetchService;
  @service declare authenticatedUser: AuthenticatedUserService;
  @service("config") declare configSvc: ConfigService;

  queryParams = {
    docType: {
      refreshModel: true,
    },
    owners: {
      refreshModel: true,
    },
    page: {
      refreshModel: true,
    },
    product: {
      refreshModel: true,
    },
    sortBy: {
      refreshModel: true,
    },
    status: {
      refreshModel: true,
    },
  };

  /**
   * Generates a URLSearchParams object for the drafts endpoint.
   */
  private createDraftURLSearchParams(
    params: AlgoliaSearchParams,
    ownerFacetOnly: boolean
  ): URLSearchParams {
    /**
     * In the case of facets, we want to filter by just the owner facet.
     * In the case of documents, we want to filter by all facets.
     */
    let facetFilters = ownerFacetOnly
      ? [`owners:${this.authenticatedUser.info.email}`]
      : this.algolia.buildFacetFilters(params);

    return new URLSearchParams(
      Object.entries({
        facets: FACET_NAMES,
        hitsPerPage: HITS_PER_PAGE,
        maxValuesPerFacet: MAX_VALUES_PER_FACET,
        facetFilters: facetFilters,
        page: params.page ? params.page - 1 : 0,
        sortBy: params["sortBy"],
        ownerEmail: this.authenticatedUser.info.email,
      })
        .map(([key, val]) => `${key}=${val}`)
        .join("&")
    );
  }

  /**
   * Fetches draft doc information based on searchParams and the current user.
   */
  private getDraftResults = task(
    async (): Promise<DraftResponseJSON | undefined> => {
      try {
        let response = await this.fetchSvc
          .fetch("/api/v1/drafts?" + this.createDraftURLSearchParams({}, true))
          .then((response) => response.json());
        return response;
      } catch (e: unknown) {
        console.error(e);
      }
    }
  );

  async model(params: DocumentsRouteParams) {
    const searchIndex =
      params.sortBy === "dateAsc"
        ? this.configSvc.config.algolia_docs_index_name + "_createdTime_asc"
        : this.configSvc.config.algolia_docs_index_name + "_createdTime_desc";

    let publishedDocResults = (await this.algolia.getDocResults.perform(
      searchIndex,
      params,
      true
    )) as SearchResponse<HermesDocument>;

    let publishedDocs = publishedDocResults.hits as HermesDocument[];

    let draftDocs = (await this.getDraftResults.perform()) as DraftResponseJSON;

    let combinedDocs = publishedDocs.concat(draftDocs.Hits).sort((a, b) => {
      return b.createdTime - a.createdTime;
    });

    return RSVP.hash({
      results: combinedDocs,
      nbPages: 0,
      page: 1,
    });
  }
}
