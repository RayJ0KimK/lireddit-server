import { MyContext } from "../types";
import {Arg, Ctx, Resolver, InputType, ObjectType, Field, Mutation} from "type-graphql";
import {User} from "../entities/User";
import argon2 from 'argon2';

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@ObjectType()
class FieldError{
    @Field()
    field: string;
    
    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError [];

    @Field(() => User, {nullable: true})
    user?: User;
}

@Resolver()
export class UserResolver{
    //The thing inside the parenthesis is some type of config of this operation
    @Mutation(() => User)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx(){em}: MyContext
    ){
        const hasedPassword = await argon2.hash(options.password);
        const user = em.create(User, {username: options.username, password: hasedPassword});
        await em.persistAndFlush(user)
        return user;
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx(){em, req}: MyContext
    ): Promise<UserResponse> {

        if (options.username.length <= 2){
            return {
                errors: [
                    {
                        field: 'username',
                        message : "length must be greater thant  2"
                    }
                ]
            }
        }

        const user = await em.findOne(User, {username: options.username});
        if (!user) {
            return {
                errors: [
                    {
                        field: 'username',
                        message: "That username doesn't exists",
                    },
                ]
            };
        }
        const valid = await argon2.verify(user.password, options.password);
        if (!valid) {
            return {
                errors: [
                    {
                        field: 'password',
                        message: "incorrect password",
                    },
                ]
            };
        }

        req.session.userId = user.id;

        return {user};
    }
}