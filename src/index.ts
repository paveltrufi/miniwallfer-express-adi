import * as bodyParser from "body-parser"
import * as express from "express"
import { Request, Response } from "express"
import "reflect-metadata"
import { createConnection } from "typeorm"
import { User } from "./entity/User"
import { Routes } from "./routes"

createConnection().then(async (connection) => {

    // create express app
    const app = express()
    app.use(bodyParser.json())

    // register express routes from defined application routes
    Routes.forEach((route) => {
        (app as any)[route.method](route.route, (req: Request, res: Response, next) => {
            const result = (new route.controller() as any)[route.action](req, res, next)
            if (result instanceof Promise) {
                result.then((r) => r !== null && r !== undefined ? res.send(r) : undefined)
            } else if (result !== null && result !== undefined) {
                res.json(result)
            }
        })
    })

    // setup express app here
    // ...

    // start express server
    app.listen(3000)

    // insert new users for test
    await connection.manager.save(connection.manager.create(User, {
        age: 27,
        firstName: "Timber",
        lastName: "Saw",
    }))
    await connection.manager.save(connection.manager.create(User, {
        age: 24,
        firstName: "Phantom",
        lastName: "Assassin",
    }))

    console.log("Express server has started on port 3000. Open http://localhost:3000/users to see results")

}).catch((error) => console.log(error))