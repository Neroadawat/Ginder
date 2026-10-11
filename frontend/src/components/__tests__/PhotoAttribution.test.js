const React = require('react');
const {Linking, Text} = require('react-native');
const {act, create} = require('react-test-renderer');

const PhotoAttribution = require('../PhotoAttribution').default;

it('renders nothing for placeholders or uncredited photos', () => {
  let tree;
  act(() => {
    tree = create(
      <PhotoAttribution
        restaurant={{
          photo_url: null,
          photo_source: null,
          photo_attribution: null,
        }}
      />,
    );
  });

  expect(tree.toJSON()).toBeNull();
});

it('shows the credit and opens an HTTP source', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  let tree;
  act(() => {
    tree = create(
      <PhotoAttribution
        restaurant={{
          photo_url: 'https://images.example/photo.jpg',
          photo_source: 'https://images.example/licence',
          photo_attribution: 'Student Club / CC BY 4.0',
        }}
      />,
    );
  });

  const link = tree.root.findByProps({accessibilityRole: 'link'});
  expect(tree.root.findByType(Text).props.children).toBe(
    'Photo: Student Club / CC BY 4.0',
  );
  await act(async () => link.props.onPress());
  expect(open).toHaveBeenCalledWith('https://images.example/licence');
  open.mockRestore();
});

it('links a visible live Google photo to its individual Google Maps source', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  let tree;
  act(() => {
    tree = create(
      <PhotoAttribution
        restaurant={{
          source: 'google_live',
          photo_url: null,
          photo_source: 'https://maps.google.com/contributor',
          photo_attribution: 'Photo author',
          google_photo_maps_uri: 'https://maps.google.com/photo/source',
        }}
        photoVisible
      />,
    );
  });

  const link = tree.root.findByProps({accessibilityRole: 'link'});
  await act(async () => link.props.onPress());
  expect(open).toHaveBeenCalledWith('https://maps.google.com/photo/source');
  open.mockRestore();
});
