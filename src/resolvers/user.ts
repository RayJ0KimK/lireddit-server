import { MyContext } from "../types";
import {Arg, Ctx, Resolver, InputType, Field, Mutation} from "type-graphql";
import {User} from "../entities/User";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@Resolver()
export class UserResolver{
    @Mutation(() => String)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx(){em}: MyContext
    ){
        const user = em.create(User, {username: options.username})
        await em.persistAndFlush(user)
        return "bye";
    }
}