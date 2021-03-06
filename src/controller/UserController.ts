import * as bcrypt from "bcrypt"
import { classToPlain, plainToClass } from "class-transformer";
import { transformAndValidate } from "class-transformer-validator"
import { NextFunction, Request, Response } from "express"
import * as HttpStatus from "http-status-codes"
import * as jwt from "jwt-simple"
import { getRepository } from "typeorm"
import * as util from "util"
import { Post } from "../entity/Post"
import { User } from "../entity/User"
import PostHalUtils from "../hateoas/PostHalUtils";
import UserHalUtils from "../hateoas/UserHalUtils";

export class UserController {

    private static secret = "putopavel123" // JWT Secret
    private userRepository = getRepository(User)
    private postRepository = getRepository(Post)

    public async getCurrentUser(request: Request, response: Response, next: NextFunction) {
        const authorizationHeader = request.get("Authorization")
        if (!authorizationHeader) {
            this.processError(new Error("Authorization header must be provided"), HttpStatus.UNAUTHORIZED, undefined)
        }
        const authorizationParts = authorizationHeader.split(" ")
        if (authorizationParts.length !== 2 || authorizationParts[0] !== "Bearer") {
            this.processError(
                new Error("Malformed Authorization header (must be 'Bearer' + token)"),
                HttpStatus.UNAUTHORIZED,
                undefined)
        }
        try {
            const decodedUser = plainToClass(User, jwt.decode(authorizationParts[1], UserController.secret) as User)
            return this.userRepository.findOneById(decodedUser.id)
            .then((foundUser) => {
                    // The equality condition is evaluated in case a manipulated token's user has another user's ID
                    if (!foundUser || !foundUser.equals(decodedUser)) {
                        this.processError(
                            new Error("Token's user not found (it may have been deleted)"),
                            HttpStatus.UNAUTHORIZED,
                            undefined)
                    }
                    return foundUser
                })
                .catch((error) =>
                    this.processError(
                        new Error("Invalid token. User may have been deleted"),
                        HttpStatus.UNAUTHORIZED,
                        undefined))
        } catch {
            this.processError(new Error("Unable to parse token"), HttpStatus.UNAUTHORIZED, undefined)
        }
    }

    /**
     * @swagger
     * /login:
     *     post:
     *         tags:
     *             - Authentication
     *         description: Given a user's credentials, it provides its JWT Token
     *         operationId: login
     *         produces:
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/login"
     *         responses:
     *             200:
     *                 $ref: "#/responses/Ok"
     *             422:
     *                 $ref: "#/responses/UnprocessableEntity"
     */
    public async login(request: Request, response: Response, next: NextFunction) {
        const username = request.body.username
        const password = request.body.password
        if (!username || !password) {
            return this.processError(
                new Error("Username and password must be provided"),
                HttpStatus.UNPROCESSABLE_ENTITY,
                undefined)
        }
        const user = new User()
        user.username = username
        const foundUser = await this.userRepository.findOne({ where: user })
        if (!foundUser || !(await bcrypt.compare(password, foundUser.password))) {
            return this.processError(new Error("Invalid credentials"), HttpStatus.UNAUTHORIZED, undefined)
        }
        return { token: jwt.encode(foundUser, UserController.secret) }
    }

    /**
     * @swagger
     * /users:
     *     get:
     *         tags:
     *             - Users
     *         description: Retrieves all the users stored in the DB
     *         operationId: "getAllUsers"
     *         produces:
     *             - application/hal+json
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/startParam"
     *             - $ref: "#/parameters/sizeParam"
     *         responses:
     *             200:
     *                 $ref: "#/responses/Ok"
     *             400:
     *                 $ref: "#/responses/ListNotPaginated"
     *             401:
     *                 $ref: "#/responses/Unauthorized"
     *         security:
     *             - jwt: []
     */
    public async all(request: Request, response: Response, next: NextFunction) {
        const skip = Number(request.query.start)
        const take = Number(request.query.size)
        if (isNaN(skip) || isNaN(take)) {
            this.processError(
                new Error("Lists must be paginated with start=<num>&size=<num> query params (use 0 to list all)"),
                HttpStatus.BAD_REQUEST)
        }
        const users = await this.userRepository.findAndCount({ skip, take })
        response.type("application/hal+json")
        return UserHalUtils.getUsersWithNavigationLinks(users, request.path, skip, take)
    }

    /**
     * @swagger
     * /users/{id}:
     *     get:
     *         tags:
     *             - Users
     *         description: Retrieves a single user stored in the DB
     *         operationId: getUser
     *         produces:
     *             - application/hal+json
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/id"
     *         responses:
     *             200:
     *                 $ref: "#/responses/Ok"
     *             401:
     *                 $ref: "#/responses/Unauthorized"
     *             404:
     *                 $ref: "#/responses/EntityNotFound"
     *         security:
     *             - jwt: []
     */
    public async one(request: Request, response: Response, next: NextFunction) {
        const userId: number = request.params.id as number;
        const user = await this.userRepository.findOneById(userId)
        if (!user) this.processError(new Error("Cannot find entity by a given id"), HttpStatus.NOT_FOUND, userId)
        response.type("application/hal+json")
        return UserHalUtils.getUserWithActionLinks(user)
    }

    /**
     * @swagger
     * /users:
     *     post:
     *         tags:
     *             - Users
     *             - Authentication
     *         description: Saves (registers) a new user to the DB
     *         operationId: saveUser
     *         produces:
     *             - application/hal+json
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/newUser"
     *         responses:
     *             201:
     *                 $ref: "#/responses/Created"
     *             422:
     *                 $ref: "#/responses/UnprocessableEntity"
     */
    public async save(request: Request, response: Response, next: NextFunction) {
        const newUser = request.body
        if (Object.keys(newUser).length === 0 && newUser.constructor === Object) {
            this.processError(new Error("Empty user data"), HttpStatus.UNPROCESSABLE_ENTITY, undefined)
        }
        return transformAndValidate(User, newUser, { validator: { validationError: { target: false } } })
            .then(async (validatedUser: User) => {
                validatedUser.password = await bcrypt.hash(validatedUser.password, 2)
                const savedUser = await this.userRepository.save(validatedUser)
                response.status(HttpStatus.CREATED)
                response.location(`${request.protocol}://${request.get("host")}${request.path}/${savedUser.id}`)
                response.type("application/hal+json")
                return UserHalUtils.getUserWithActionLinks(savedUser)
            })
            .catch((error) =>
                this.processError(error, HttpStatus.UNPROCESSABLE_ENTITY, undefined, newUser.username))
    }

    /**
     * @swagger
     * /users/{id}:
     *     put:
     *         tags:
     *             - Users
     *         description: Updates a selected user and merges it to the DB
     *         operationId: updateUser
     *         produces:
     *             - application/hal+json
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/id"
     *             - $ref: "#/parameters/newUser"
     *         responses:
     *             201:
     *                 $ref: "#/responses/Created"
     *             401:
     *                 $ref: "#/responses/Unauthorized"
     *             422:
     *                 $ref: "#/responses/UnprocessableEntity"
     *         security:
     *             - jwt: []
     */
    public async update(request: Request, response: Response, next: NextFunction) {
        const userId = request.params.id;
        const modifiedUser = request.body
        if (Object.keys(modifiedUser).length === 0 && modifiedUser.constructor === Object) {
            response.status(HttpStatus.UNPROCESSABLE_ENTITY).send({ message: "Empty user data" })
        }
        return transformAndValidate(User, modifiedUser, { validator: { validationError: { target: false } } })
            .then(async (validatedUser: User) => {
                await this.userRepository.updateById(userId, validatedUser)
                response.status(HttpStatus.CREATED)
                response.type("application/hal+json")
                return UserHalUtils.getUserWithActionLinks(await this.userRepository.findOneById(userId))
            })
            .catch((error) =>
                this.processError(error, HttpStatus.UNPROCESSABLE_ENTITY, userId, modifiedUser.username))
    }

    /**
     * @swagger
     * /users/{id}:
     *     delete:
     *         tags:
     *             - Users
     *         description: Deletes a selected user from the DB
     *         operationId: deleteUser
     *         produces:
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/id"
     *         responses:
     *             204:
     *                 $ref: "#/responses/EmptyResponse"
     *             401:
     *                 $ref: "#/responses/Unauthorized"
     *             404:
     *                 $ref: "#/responses/EntityNotFound"
     *         security:
     *             - jwt: []
     */
    public async remove(request: Request, response: Response, next: NextFunction) {
        const userId = request.params.id
        await this.userRepository.removeById(userId)
            .catch((error) => this.processError(error, HttpStatus.NOT_FOUND, userId))
        response.status(HttpStatus.NO_CONTENT).end()
    }

    /**
     * @swagger
     * /users/{id}/posts:
     *     get:
     *         tags:
     *             - Posts
     *         description: Retrieves all the posts from a specified user stored in the DB
     *         operationId: "getAllUserPosts"
     *         produces:
     *             - application/hal+json
     *             - application/json
     *         parameters:
     *             - $ref: "#/parameters/id"
     *             - $ref: "#/parameters/startParam"
     *             - $ref: "#/parameters/sizeParam"
     *         responses:
     *             200:
     *                 $ref: "#/responses/Ok"
     *             400:
     *                 $ref: "#/responses/BadUrl"
     *             400-v2:
     *                 $ref: "#/responses/ListNotPaginated"
     *             401:
     *                 $ref: "#/responses/Unauthorized"
     *             404:
     *                 $ref: "#/responses/EntityNotFound"
     *         security:
     *             - jwt: []
     */
    public async posts(request: Request, response: Response, next: NextFunction) {
        const skip = Number(request.query.start)
        const take = Number(request.query.size)
        if (isNaN(skip) || isNaN(take)) {
            this.processError(
                new Error("Lists must be paginated with start=<num>&size=<num> query params (use 0 to list all)"),
                HttpStatus.BAD_REQUEST)
        }
        const userId: number = request.params.id as number;
        const user = await this.userRepository.findOneById(userId)
        if (!user) this.processError(new Error("Cannot find entity by a given id"), HttpStatus.BAD_REQUEST, userId)
        const selectQueryBuilder = await this.postRepository
            .createQueryBuilder("post")
            .leftJoinAndSelect("post.user", "user")
            .where(`user.id == ${userId}`)
        const posts = await selectQueryBuilder.skip(skip).take(take).getMany()
        const postCount = await selectQueryBuilder.getCount()
        response.type("application/hal+json")
        return PostHalUtils.getPostsWithNavigationLinks([posts, postCount], request.path, skip, take)
    }

    /**
     * @swagger
     * /users/{userId}/posts/{postId}:
     *     get:
     *         tags:
     *             - Posts
     *         description: Retrieves a selected post (from the given user) from the DB
     *         operationId: getUserPost
     *         produces:
     *             - application/json
     *         parameters:
     *             - allOf:
     *                 - $ref: "#/parameters/id"
     *                 - name: "userId"
     *                 - description: "User's ID"
     *             - allOf:
     *                 - $ref: "#/parameters/id"
     *                 - name: "postId"
     *                 - description: "Post's ID"
     *         responses:
     *             200:
     *                 $ref: "#/responses/Ok"
     *             400:
     *                 $ref: "#/responses/BadUrl"
     *             401:
     *                 $ref: "#/responses/Unauthorized"
     *             404:
     *                 $ref: "#/responses/EntityNotFound"
     *         security:
     *             - jwt: []
     */
    public async post(request: Request, response: Response, next: NextFunction) {
        const userId = Number(request.params.userId)
        const postId = Number(request.params.postId)
        const user = await this.userRepository.findOneById(userId)
        if (!user) this.processError(new Error("Cannot find entity by a given id"), HttpStatus.BAD_REQUEST, userId)
        const post = await this.postRepository.findOneById(postId)
        if (!post) this.processError(new Error("Cannot find post by a given id"), HttpStatus.BAD_REQUEST, postId)
        if (!(await this.checkPostBelongToUser(userId, postId))) {
            this.processError(new Error(`This post doesn't belong to this user`), HttpStatus.NOT_FOUND)
        }
        response.type("application/hal+json")
        return PostHalUtils.getPostWithActionLinks(post)
    }

    private async checkPostBelongToUser(userId: number, postId: number) {
        return await this.postRepository
            .createQueryBuilder("post")
            .leftJoinAndSelect("post.user", "user")
            .where(`user.id == ${userId}`)
            .andWhere(`post.id == ${postId}`)
            .getCount() === 1
    }

    /**
     * Processes any error thrown by the repository or even the DB.
     *
     * If the error is something like "Cannot find",
     * wich means that provided ID doesn't exist, it will customize the error.
     *
     * If the error is something like "UNIQUE...username", wich is a DB constraint,
     * it will customize the error with the already existing one.
     *
     * Otherwise, it will throw the error "as is"
     * @param error the error to process
     * @param status the http status code
     * @param userId the user's ID (can be undefined if username provided)
     * @param username the username (optional)
     */
    private processError(error: Error, status: number, userId?: number, username?: string) {
        if (!error.message) throw { message: error, status }
        let message = error.message
        if (message.match(/.*Cannot find.*/i)) {
            status = HttpStatus.NOT_FOUND
            message = message
                .replace("entity", "user")
                .replace(/ a.*id/, ` the given id: ${userId}`)
        } else if (message.match(/.*UNIQUE.*username.*/i)) {
            message = `Username ${username} already taken`
        }
        throw { message, status }
    }
}
