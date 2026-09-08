/**
 * Deep linking configuration for handling invite links.
 *
 * Deep link format: ginder://session/join?code=<invite_code>
 */

import {LinkingOptions} from '@react-navigation/native';
import {RootStackParamList} from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ginder://', 'https://ginder.app'],
  config: {
    screens: {
      Session: {
        path: 'session',
        screens: {
          JoinSession: {
            path: 'join',
            parse: {code: (code: string) => code},
          },
        },
      },
      Main: {
        screens: {
          HomeTab: '',
        },
      },
    },
  },
};
