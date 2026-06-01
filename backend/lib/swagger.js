const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hyperviseur HI² API",
      version: "1.0.0",
      description:
        "API REST du superviseur photovoltaïque HI². " +
        "Disponible uniquement en environnement non-production.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan toutes les routes pour les annotations JSDoc @swagger
  apis: ["./routes/*.js"],
};

const spec = swaggerJsdoc(options);

/**
 * Monte /api/docs uniquement hors production.
 * En production, renvoie 404 pour ne pas exposer la surface d'attaque.
 *
 * @param {import('express').Application} app
 */
function setupSwagger(app) {
  if (process.env.NODE_ENV === "production") {
    app.get("/api/docs", (req, res) => res.status(404).end());
    return;
  }

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.get("/api/docs.json", (req, res) => res.json(spec));

  console.log("[Swagger] Docs available at /api/docs");
}

module.exports = { setupSwagger };
