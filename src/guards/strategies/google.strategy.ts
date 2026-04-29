import { ApiConfigService } from '@/libs';
import { UsersService } from '@/modules';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { isDefined } from 'class-validator';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ApiConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, emails, name } = profile;

    const email = emails?.at(0)?.value;
    const firstName = name?.givenName;
    const lastName = name?.familyName;

    //TODO add [pictures]
    // const picture = photos?.at(0)?.value;

    if (!isDefined(email) || !isDefined(firstName) || !isDefined(lastName)) {
      throw new Error('Incomplete Google profile!');
    }

    const user = await this.usersService.findOrCreateGoogleUser({
      googleId: id,
      email,
      firstName,
      lastName,
    });

    done(null, user);
  }
}
