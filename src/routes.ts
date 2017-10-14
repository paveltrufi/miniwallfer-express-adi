import { PostController } from "./controller/PostController"
import { UserController } from "./controller/UserController"

export const Routes = [{
    action: "login",
    controller: UserController,
    method: "post",
    route: "/login",
}, {
    action: "save",
    controller: UserController,
    method: "post",
    route: "/register", // Register action actually means save a new user
}, {
    action: "all",
    controller: UserController,
    method: "get",
    route: "/users",
}, {
    action: "one",
    controller: UserController,
    method: "get",
    route: "/users/:id",
}, {
    action: "update",
    controller: UserController,
    method: "put",
    route: "/users/:id",
}, {
    action: "remove",
    controller: UserController,
    method: "delete",
    route: "/users/:id",
}, {
    action: "posts",
    controller: UserController,
    method: "get",
    route: "/users/:id/posts",
}, {
    action: "all",
    controller: PostController,
    method: "get",
    route: "/posts",
}, {
    action: "one",
    controller: PostController,
    method: "get",
    route: "/posts/:id",
}, {
    action: "save",
    controller: PostController,
    method: "post",
    route: "/users/:id/posts",
}, {
    action: "update",
    controller: PostController,
    method: "put",
    route: "/users/:userId/posts/:postId",
}, {
    action: "remove",
    controller: PostController,
    method: "delete",
    route: "/users/:userId/posts/:postId",
}]
