# 737 MAX Interface Image

For the application to display correctly, please add a file named `737max-interface.jpg` to this directory. The image should be of the Boeing 737 MAX in-cabin entertainment or maintenance interface screen.

You can use the image that was shown in the original chat, or find a suitable replacement online.

## File Requirements:
- Filename: `737max-interface.jpg`
- Format: JPG (JPEG)
- Recommended resolution: At least 1280x720 pixels
- Content: Boeing 737 MAX interface screen

## Alternative Solution
If you don't have access to the exact image, you can also modify the CSS in `src/components/Boeing737Interface.css` to use a different image or a solid color background instead.

Look for the following section in the CSS file:
```css
.boeing-content-manual {
  background-image: url('/737max-interface.jpg');
  /* other properties... */
}
```

And replace it with either:
```css
.boeing-content-manual {
  background: linear-gradient(to bottom, #5a6373, #3f4655);
  /* other properties... */
}
```

Or point to a different image:
```css
.boeing-content-manual {
  background-image: url('/your-alternative-image.jpg');
  /* other properties... */
}
``` 