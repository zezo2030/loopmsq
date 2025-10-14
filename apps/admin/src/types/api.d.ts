// Minimal OpenAPI types stub to satisfy Phase-00 acceptance
// Replace by running: npm run gen:openapi when backend Swagger is available

export interface components {
  schemas: {
    MeResponse: {
      id: string
      roles?: string[]
      name?: string
      email?: string
      language?: string
    }
  }
}

export type paths = {
  "/auth/me": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["MeResponse"]
          }
        }
      }
    }
  }
}





