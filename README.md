# Pip for Fire TV

Pip helps families watch, understand and play together on Fire TV. Everyone joins from their own screen, the Pip Pad replaces the remote, Pip answers questions about the film without spoilers, and a short quiz turns the film into a game.

Status: in development

The plan, architecture, contracts and build order are in [PROJECT.md](PROJECT.md).

## Known issues

Found while walking through every failure in PROJECT.md section 4.10 (Step 10). Each one recovers by itself.

- After a server restart, a pad that reconnects before the TV shows "Looking for your TV" until its next try, up to 10 s later. The 10 s retry (PROJECT.md 4.5) keeps a family of 8 on one home address under the join limit.
- If the host leaves and comes back last, the first player back gets the host controls only when the host's 10 s grace has run out.
- iPhone Safari has no full-screen mode for web pages, so there the pad keeps the browser bars. Added to the home screen, it opens without them.

## Credits

Big Buck Bunny, (c) copyright 2008 Blender Foundation, www.bigbuckbunny.org, CC BY 3.0
