from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

out = Path('outputs/security-import-audit')
out.mkdir(parents=True, exist_ok=True)
image = Image.new('RGB', (1400, 1400), '#fffdf4')
draw = ImageDraw.Draw(image)
typed = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 42)
heading = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 64)
hand = ImageFont.truetype('C:/Windows/Fonts/segoesc.ttf', 45)
draw.text((85, 65), 'Carrot Soup', font=heading, fill='#202020')
for y, text in enumerate(['2 carrots, chopped', '2 cups water', '1/4 teaspoon salt', '', '1. Put carrots and water in a saucepan.', '2. Simmer for 20 minutes until tender.']):
    draw.text((85, 190 + y * 90), text, font=typed, fill='#202020')
draw.text((90, 790), '3. Mash gently. Stir in the salt.', font=hand, fill='#163b87')
draw.text((90, 900), 'Serves 2. Add 1 tablespoon butter.', font=hand, fill='#163b87')
draw.text((90, 1030), 'Prep time: 5 minutes', font=typed, fill='#202020')
image.save(out / 'typed-and-script-recipe.png')
print(out / 'typed-and-script-recipe.png')
