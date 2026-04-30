import { ApiConfigService } from '@/libs';
import { AvailabilityService, UsersService } from '@/modules';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { isDefined } from '@/utils';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    readonly configService: ApiConfigService,
    private readonly usersService: UsersService,
    private readonly availabilityService: AvailabilityService,
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
    const { id, emails } = profile;

    const email = emails?.at(0)?.value;

    if (!isDefined(email)) {
      throw new Error('No Google email found!');
    }

    const nickname = this.availabilityService.createNickname(
      email.split('@')[0],
    );

    const user = await this.usersService.findOrCreateGoogleUser({
      googleId: id,
      email,
      nickname,
    });

    done(null, user);
  }
}
