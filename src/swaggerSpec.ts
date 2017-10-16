import SwaggerJSDoc = require("swagger-jsdoc")

const swaggerDefinition = {
    info: {
        title: "Mini Wallfer",
        description: "Minimalistic implementation of the Wallfer platform for colleges",
        contact: {
            name: "API Support",
            email: "pr18@alu.ua.es",
        },
        license: {
            name: "Apache 2.0",
            url: "http://www.apache.org/licenses/LICENSE-2.0.html",
        },
        version: "0.1.1",
    },
}

const options = {
    swaggerDefinition,
    apis: [`${__dirname}/controller/*.ts`],
}

export default SwaggerJSDoc(options)