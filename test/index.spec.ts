import * as chai from "chai"
import chaiHttp = require("chai-http")
import "chai/register-should"
import * as HttpStatus from "http-status-codes"
import "reflect-metadata"
import server = require("../src/server")
import { getConnection } from "./testConnection"

chai.use(chaiHttp)
const should = chai.should()

describe("Example test", async () => {
    let testServer = null
    before("Starting server...", async () => {
        await getConnection.then(async (connection) => {
            testServer = server.createServer()
        }).catch((error) => console.log(error))
    })

    describe("Index test", () => {
        it("Test example", async () => {
            const res = await chai.request(testServer).get("/") as ChaiHttp.Response
            res.status.should.be.equal(HttpStatus.OK)
            res.should.be.html
            res.text.should.not.be.null
            res.text.should.include("swagger").and.include("pr18@alu.ua.es")
        })

    })
})
